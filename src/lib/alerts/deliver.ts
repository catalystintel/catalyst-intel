import type { AlertChannel, AlertRuleConditions } from "@/db/schema";
import { classifySession, sessionMatches } from "@/lib/alerts/session";
import { validateWebhookUrl } from "@/lib/alerts/webhook-url";

export interface AlertCatalystPayload {
  id: number;
  ticker: string | null;
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

  return true;
}

function buildBody(catalyst: AlertCatalystPayload, ruleName: string) {
  return {
    source: "catalyst-intel",
    rule: ruleName,
    catalyst: {
      id: catalyst.id,
      ticker: catalyst.ticker,
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
  const validated = validateWebhookUrl(url);
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
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      detail: "RESEND_API_KEY not configured — email delivery skipped.",
    };
  }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Catalyst Intel <onboarding@resend.dev>";

  const subject = `[Catalyst] ${catalyst.ticker ?? "—"} · ${catalyst.headline ?? catalyst.title}`;
  const proof = catalyst.sourceUrl
    ? `\nProof (EDGAR): ${catalyst.sourceUrl}`
    : "";
  const text = [
    `Rule: ${ruleName}`,
    `Ticker: ${catalyst.ticker ?? "—"}`,
    `Event: ${catalyst.headline ?? catalyst.title}`,
    `Category: ${catalyst.eventCategory ?? "—"}`,
    `Materiality: ${catalyst.impactScore ?? "—"}`,
    `Filed: ${catalyst.timestamp}`,
    proof,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        detail: `Resend HTTP ${res.status}${body ? `: ${body.slice(0, 180)}` : ""}`,
      };
    }
    return { ok: true, detail: "Email sent via Resend" };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "Email failed",
    };
  }
}

/**
 * Evaluates rules against a catalyst and delivers matching email/webhook
 * channels. Push is stubbed (skipped with a clear message).
 */
export async function deliverAlertRules(options: {
  catalyst: AlertCatalystPayload;
  rules: DeliverableRule[];
  /** When true, skip condition matching (admin test fire). */
  force?: boolean;
}): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];

  for (const rule of options.rules) {
    if (!options.force && !conditionsMatch(options.catalyst, rule.conditions)) {
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
      results.push({
        ruleId: rule.id,
        channel: "push",
        ok: true,
        skipped: true,
        detail: "Push notifications coming soon (no FCM configured).",
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

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}
