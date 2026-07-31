import type { AlertChannel, AlertRuleConditions } from "@/db/schema";
import { classifySession, sessionMatches } from "@/lib/alerts/session";
import { assertWebhookUrlSafeForFetch } from "@/lib/alerts/webhook-url";
import { sendResendEmail } from "@/lib/email/resend";
import { sendWebPush, type PushSubscriptionRecord } from "@/lib/push/web-push";
import { sendTelegramMessage } from "@/lib/telegram/bot";

export interface AlertCatalystPayload {
  id: number;
  symbol: string | null;
  headline: string | null;
  title: string;
  eventCategory: string | null;
  impactScore: number | null;
  timestamp: string;
  sourceUrl: string | null;
}

export interface DeliverableRule {
  id: number;
  name: string;
  channel: AlertChannel;
  webhookUrl: string | null;
  emailTo: string | null;
  telegramChatId: string | null;
  conditions: AlertRuleConditions;
}

export interface DeliveryResult {
  ruleId: number;
  channel: AlertChannel;
  ok: boolean;
  skipped?: boolean;
  detail: string;
}

function conditionsMatch(
  catalyst: AlertCatalystPayload,
  conditions: AlertRuleConditions,
  watchlistSymbols?: Set<string>,
): boolean {
  const cats = conditions.categories ?? [];
  if (cats.length > 0) {
    if (!catalyst.eventCategory || !cats.includes(catalyst.eventCategory)) {
      return false;
    }
  }

  const minImpact = conditions.minImpact;
  if (typeof minImpact === "number") {
    const score = catalyst.impactScore ?? 0;
    if (score < minImpact) return false;
  }

  const filingSession = classifySession(catalyst.timestamp);
  if (!sessionMatches(filingSession, conditions.sessions)) return false;

  if (conditions.watchlistOnly) {
    const symbol = catalyst.symbol?.toUpperCase();
    if (!symbol || !watchlistSymbols?.has(symbol)) return false;
  }

  return true;
}

function buildBody(catalyst: AlertCatalystPayload, ruleName: string) {
  return {
    source: "catalyst-intel",
    rule: ruleName,
    catalyst: {
      id: catalyst.id,
      symbol: catalyst.symbol,
      headline: catalyst.headline ?? catalyst.title,
      eventCategory: catalyst.eventCategory,
      impactScore: catalyst.impactScore,
      timestamp: catalyst.timestamp,
      sourceUrl: catalyst.sourceUrl,
    },
  };
}

async function deliverWebhook(
  url: string,
  body: unknown,
): Promise<{ ok: boolean; detail: string }> {
  const validated = await assertWebhookUrlSafeForFetch(url);
  if (!validated.ok) {
    return { ok: false, detail: validated.reason };
  }

  try {
    const res = await fetch(validated.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
      // Avoid open-redirect bounce to an internal host after hostname checks.
      redirect: "error",
    });
    if (!res.ok) {
      return { ok: false, detail: `Webhook HTTP ${res.status}` };
    }
    return { ok: true, detail: `Webhook delivered (${res.status})` };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "Webhook failed",
    };
  }
}

async function deliverEmail(
  to: string,
  catalyst: AlertCatalystPayload,
  ruleName: string,
): Promise<{ ok: boolean; detail: string }> {
  const subject = `[Catalyst] ${catalyst.symbol ?? "—"} · ${catalyst.headline ?? catalyst.title}`;
  const proof = catalyst.sourceUrl
    ? `\nProof (EDGAR): ${catalyst.sourceUrl}`
    : "";
  const text = [
    `Rule: ${ruleName}`,
    `Symbol: ${catalyst.symbol ?? "—"}`,
    `Event: ${catalyst.headline ?? catalyst.title}`,
    `Category: ${catalyst.eventCategory ?? "—"}`,
    `Materiality: ${catalyst.impactScore ?? "—"}`,
    `Filed: ${catalyst.timestamp}`,
    proof,
  ]
    .filter(Boolean)
    .join("\n");

  return sendResendEmail({ to, subject, text });
}

async function deliverTelegram(
  chatId: string,
  catalyst: AlertCatalystPayload,
  ruleName: string,
): Promise<{ ok: boolean; detail: string }> {
  const proof = catalyst.sourceUrl
    ? `\nProof (EDGAR): ${catalyst.sourceUrl}`
    : "";
  const text = [
    `🔔 ${ruleName}`,
    `${catalyst.symbol ?? "—"} · ${catalyst.headline ?? catalyst.title}`,
    `Category: ${catalyst.eventCategory ?? "—"}`,
    `Materiality: ${catalyst.impactScore ?? "—"}`,
    `Filed: ${catalyst.timestamp}`,
    proof,
  ]
    .filter(Boolean)
    .join("\n");

  return sendTelegramMessage({ chatId, text });
}

async function deliverPush(
  subscriptions: PushSubscriptionRecord[],
  catalyst: AlertCatalystPayload,
  ruleName: string,
  onDeadSubscription?: (endpoint: string) => void | Promise<void>,
): Promise<{ ok: boolean; detail: string }> {
  if (subscriptions.length === 0) {
    return {
      ok: false,
      detail:
        "No push subscriptions — enable browser notifications in Settings.",
    };
  }

  const payload = {
    title: `${catalyst.symbol ?? "Catalyst"} · ${ruleName}`,
    body: catalyst.headline ?? catalyst.title,
    url: catalyst.sourceUrl ?? undefined,
  };

  const outcomes = await Promise.all(
    subscriptions.map(async (sub) => {
      const result = await sendWebPush(sub, payload);
      if (result.gone && onDeadSubscription) {
        await onDeadSubscription(sub.endpoint);
      }
      return result;
    }),
  );

  const ok = outcomes.some((o) => o.ok);
  const detail = ok
    ? `Push delivered to ${outcomes.filter((o) => o.ok).length}/${outcomes.length} device(s)`
    : (outcomes[0]?.detail ?? "Push failed");
  return { ok, detail };
}

/**
 * Evaluates rules against a catalyst and delivers matching email / webhook /
 * push / Telegram channels.
 */
export async function deliverAlertRules(options: {
  catalyst: AlertCatalystPayload;
  rules: DeliverableRule[];
  /** When true, skip condition matching (admin test fire). */
  force?: boolean;
  /**
   * Uppercase symbols on the rule owner's watchlist — required for
   * `watchlistOnly` conditions to match. Omit = treat as empty watchlist.
   */
  watchlistSymbols?: string[];
  /** Web Push subscriptions for the rules' owner (all rules share one user). */
  pushSubscriptions?: PushSubscriptionRecord[];
  /** Lets the caller prune a subscription that the push service reports gone. */
  onDeadPushSubscription?: (endpoint: string) => void | Promise<void>;
}): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];
  const watchlistSet = new Set(
    (options.watchlistSymbols ?? []).map((t) => t.toUpperCase()),
  );

  for (const rule of options.rules) {
    if (
      !options.force &&
      !conditionsMatch(options.catalyst, rule.conditions, watchlistSet)
    ) {
      results.push({
        ruleId: rule.id,
        channel: rule.channel,
        ok: true,
        skipped: true,
        detail: "Conditions not matched — skipped",
      });
      continue;
    }

    if (rule.channel === "push") {
      const delivered = await deliverPush(
        options.pushSubscriptions ?? [],
        options.catalyst,
        rule.name,
        options.onDeadPushSubscription,
      );
      results.push({
        ruleId: rule.id,
        channel: "push",
        ok: delivered.ok,
        detail: delivered.detail,
      });
      continue;
    }

    if (rule.channel === "telegram") {
      const chatId = rule.telegramChatId?.trim();
      if (!chatId) {
        results.push({
          ruleId: rule.id,
          channel: "telegram",
          ok: false,
          detail: "Missing Telegram chat id",
        });
        continue;
      }
      const delivered = await deliverTelegram(
        chatId,
        options.catalyst,
        rule.name,
      );
      results.push({
        ruleId: rule.id,
        channel: "telegram",
        ok: delivered.ok,
        detail: delivered.detail,
      });
      continue;
    }

    const body = buildBody(options.catalyst, rule.name);

    if (rule.channel === "webhook") {
      if (!rule.webhookUrl) {
        results.push({
          ruleId: rule.id,
          channel: "webhook",
          ok: false,
          detail: "Missing webhook URL",
        });
        continue;
      }
      const delivered = await deliverWebhook(rule.webhookUrl, body);
      results.push({
        ruleId: rule.id,
        channel: "webhook",
        ok: delivered.ok,
        detail: delivered.detail,
      });
      continue;
    }

    if (rule.channel === "email") {
      const to = rule.emailTo?.trim();
      if (!to) {
        results.push({
          ruleId: rule.id,
          channel: "email",
          ok: false,
          detail: "Missing email recipient",
        });
        continue;
      }
      const delivered = await deliverEmail(to, options.catalyst, rule.name);
      results.push({
        ruleId: rule.id,
        channel: "email",
        ok: delivered.ok,
        detail: delivered.detail,
      });
    }
  }

  return results;
}

export { isResendConfigured } from "@/lib/email/resend";
export { isWebPushConfigured, webPushPublicKey } from "@/lib/push/web-push";
export { isTelegramConfigured } from "@/lib/telegram/bot";
