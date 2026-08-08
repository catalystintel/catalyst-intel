import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { alertRules, type AlertChannel } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import {
  isResendConfigured,
  isTelegramConfigured,
  isWebPushConfigured,
  webPushPublicKey,
} from "@/lib/alerts/deliver";
import {
  getTelegramBotUsername,
  resolveTelegramBotIdentity,
} from "@/lib/telegram/bot";
import {
  getTelegramLinkByUserId,
  isTelegramLinkMuted,
} from "@/lib/telegram/link";
import { normalizeAlertConditions } from "@/lib/alerts/normalize";
import { deriveNotificationSettings } from "@/lib/alerts/settings-model";
// import { validateWebhookUrl } from "@/lib/alerts/webhook-url"; // revive with webhook channel
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";
import {
  isSameOriginRequest,
  sameOriginForbiddenResponse,
} from "@/lib/http/same-origin";

const CHANNELS = new Set<AlertChannel>([
  "email",
  // "webhook" — paused until Slack/Discord-shaped payloads ship
  "push",
  "telegram",
]);

const WEBHOOK_PAUSED_MESSAGE =
  "Webhook alerts are temporarily unavailable. Use Push, Telegram, or Email.";

async function requireUser(
  request: NextRequest,
  options?: { mutate?: boolean },
) {
  if (!isLibsqlConfigured()) {
    return {
      error: NextResponse.json(
        { error: databaseUnavailableMessage() },
        { status: 503 },
      ),
    };
  }

  if (options?.mutate && !isSameOriginRequest(request)) {
    return { error: sameOriginForbiddenResponse() };
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `alert-rules:${ip}`,
    ...RATE_LIMITS.userWrite,
  });
  if (!limitResult.ok) {
    return { error: rateLimitExceededResponse(limitResult) };
  }

  const user = await getCurrentAppUser();
  if (!user) {
    return {
      error: withRateLimitHeaders(
        NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
        limitResult,
      ),
    };
  }

  return { user, limitResult };
}

function serializeRule(row: typeof alertRules.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    enabled: Boolean(row.enabled),
    webhookUrl: row.webhookUrl,
    emailTo: row.emailTo,
    telegramChatId: row.telegramChatId,
    conditions: normalizeAlertConditions(row.conditions),
    createdAt: row.createdAt,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth && auth.error) return auth.error;
  const { user, limitResult } = auth as {
    user: NonNullable<(typeof auth)["user"]>;
    limitResult: NonNullable<(typeof auth)["limitResult"]>;
  };

  const rows = await db
    .select()
    .from(alertRules)
    .where(eq(alertRules.userId, user.id))
    .orderBy(desc(alertRules.createdAt))
    .all();

  const telegramConfigured = isTelegramConfigured();
  const telegramBot = telegramConfigured
    ? await resolveTelegramBotIdentity()
    : {
        username: getTelegramBotUsername() ?? null,
        firstName: null,
        deepLink: null,
        handle: null,
      };
  const telegramLink = await getTelegramLinkByUserId(user.id);
  const settings = deriveNotificationSettings(
    rows.map((r) => ({
      channel: r.channel,
      enabled: Boolean(r.enabled),
      conditions: normalizeAlertConditions(r.conditions),
    })),
  );

  return withRateLimitHeaders(
    NextResponse.json({
      rules: rows.map(serializeRule),
      settings,
      emailConfigured: isResendConfigured(),
      sessionEmail: user.email,
      pushAvailable: isWebPushConfigured(),
      pushPublicKey: webPushPublicKey(),
      telegramConfigured,
      telegramBotUsername: telegramBot.username,
      telegramBotName: telegramBot.firstName,
      telegramBotHandle: telegramBot.handle,
      telegramBotDeepLink: telegramBot.deepLink,
      telegramLinked: telegramLink
        ? {
            chatId: telegramLink.chatId,
            username: telegramLink.username,
            mutedUntil: telegramLink.mutedUntil,
            muted: isTelegramLinkMuted(telegramLink),
            linkedAt: telegramLink.linkedAt,
          }
        : null,
    }),
    limitResult,
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request, { mutate: true });
  if ("error" in auth && auth.error) return auth.error;
  const { user, limitResult } = auth as {
    user: NonNullable<(typeof auth)["user"]>;
    limitResult: NonNullable<(typeof auth)["limitResult"]>;
  };

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
      limitResult,
    );
  }

  const raw =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  const name =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim().slice(0, 80)
      : "Untitled rule";
  const channel =
    typeof raw.channel === "string" && CHANNELS.has(raw.channel as AlertChannel)
      ? (raw.channel as AlertChannel)
      : null;
  if (!channel) {
    if (raw.channel === "webhook") {
      return withRateLimitHeaders(
        NextResponse.json({ error: WEBHOOK_PAUSED_MESSAGE }, { status: 400 }),
        limitResult,
      );
    }
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "channel must be email, push, or telegram." },
        { status: 400 },
      ),
      limitResult,
    );
  }

  const telegramChatIdRaw =
    typeof raw.telegramChatId === "string" && raw.telegramChatId.trim()
      ? raw.telegramChatId.trim()
      : null;
  const linked =
    channel === "telegram" && !telegramChatIdRaw
      ? await getTelegramLinkByUserId(user.id)
      : null;
  const telegramChatId = telegramChatIdRaw ?? linked?.chatId ?? null;
  const conditions = normalizeAlertConditions(raw.conditions);
  const enabled = raw.enabled === undefined ? true : Boolean(raw.enabled);

  /*
   * Webhook create — paused. To revive:
   * 1. Add "webhook" back to CHANNELS
   * 2. Restore validateWebhookUrl import + URL checks
   * 3. Uncomment webhook card in alert-rules-panel.tsx
   */
  // Email alerts always go to the signed-in user's verified session email.
  const emailTo = channel === "email" ? user.email : null;
  if (channel === "email" && !emailTo) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "Signed-in email is required for email rules." },
        { status: 400 },
      ),
      limitResult,
    );
  }
  if (channel === "telegram" && !telegramChatId) {
    return withRateLimitHeaders(
      NextResponse.json(
        {
          error:
            "Connect Telegram from Alerts (or paste a chat ID) before saving a Telegram rule.",
        },
        { status: 400 },
      ),
      limitResult,
    );
  }

  const row = await db
    .insert(alertRules)
    .values({
      userId: user.id,
      name,
      channel,
      enabled,
      webhookUrl: null,
      emailTo,
      telegramChatId: channel === "telegram" ? telegramChatId : null,
      conditions,
    })
    .returning()
    .get();

  return withRateLimitHeaders(
    NextResponse.json(serializeRule(row), { status: 201 }),
    limitResult,
  );
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request, { mutate: true });
  if ("error" in auth && auth.error) return auth.error;
  const { user, limitResult } = auth as {
    user: NonNullable<(typeof auth)["user"]>;
    limitResult: NonNullable<(typeof auth)["limitResult"]>;
  };

  const idParam = Number(request.nextUrl.searchParams.get("id") ?? "");
  if (!Number.isFinite(idParam) || idParam < 1) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Invalid id." }, { status: 400 }),
      limitResult,
    );
  }

  await db
    .delete(alertRules)
    .where(and(eq(alertRules.id, idParam), eq(alertRules.userId, user.id)))
    .run();

  return withRateLimitHeaders(
    NextResponse.json({ ok: true, id: idParam }),
    limitResult,
  );
}
