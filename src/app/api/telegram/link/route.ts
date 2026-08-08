import { NextResponse, type NextRequest } from "next/server";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { getCurrentAppUser } from "@/lib/auth/current-user";
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
import { getTelegramWebhookOrigin } from "@/lib/http/origin";
import {
  ensureTelegramWebhook,
  isTelegramConfigured,
} from "@/lib/telegram/bot";
import {
  createTelegramLinkSession,
  probeTelegramLinkHealth,
  unlinkTelegramForUser,
} from "@/lib/telegram/link";

async function requireUser(
  request: NextRequest,
  mutate: boolean,
  limit: { limit: number; windowMs: number } = RATE_LIMITS.userWrite,
) {
  if (!isLibsqlConfigured()) {
    return {
      error: NextResponse.json(
        { error: databaseUnavailableMessage() },
        { status: 503 },
      ),
    };
  }

  if (mutate && !isSameOriginRequest(request)) {
    return { error: sameOriginForbiddenResponse() };
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: mutate ? `telegram-link:${ip}` : `telegram-link-read:${ip}`,
    ...limit,
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

/**
 * Current link status + quiet Bot API health (getChat) for the signed-in user.
 * Safe to poll from /alerts — never sends a Telegram message.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request, false, RATE_LIMITS.telegramLinkRead);
  if ("error" in auth && auth.error) return auth.error;
  const { user, limitResult } = auth as {
    user: NonNullable<(typeof auth)["user"]>;
    limitResult: NonNullable<(typeof auth)["limitResult"]>;
  };

  const health = await probeTelegramLinkHealth(user.id);
  return withRateLimitHeaders(
    NextResponse.json({
      configured: isTelegramConfigured(),
      linked: health.linked,
      status: health.status,
      detail: health.detail,
      checkedAt: health.checkedAt,
    }),
    limitResult,
  );
}

/**
 * Start Connect Telegram: create a short-lived token and return a
 * `t.me/<bot>?start=<token>` deep link.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request, true);
  if ("error" in auth && auth.error) return auth.error;
  const { user, limitResult } = auth as {
    user: NonNullable<(typeof auth)["user"]>;
    limitResult: NonNullable<(typeof auth)["limitResult"]>;
  };

  if (!isTelegramConfigured()) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "Telegram bot is not configured on this deployment." },
        { status: 503 },
      ),
      limitResult,
    );
  }

  // Self-heal: point Telegram at THIS deployment so /start gets a reply.
  // Avoids dead webhooks when NEXT_PUBLIC_APP_URL / prod host is wrong.
  const webhookUrl = `${getTelegramWebhookOrigin(request)}/api/telegram/webhook`;
  const webhook = await ensureTelegramWebhook(webhookUrl);
  if (!webhook.ok) {
    return withRateLimitHeaders(
      NextResponse.json(
        {
          error:
            "Telegram webhook is not registered. Open Admin → Setup Telegram bot (check TELEGRAM_WEBHOOK_SECRET), then try again.",
          detail: webhook.detail,
        },
        { status: 503 },
      ),
      limitResult,
    );
  }

  const session = await createTelegramLinkSession(user.id);
  if (!session.deepLink || !session.webDeepLink) {
    return withRateLimitHeaders(
      NextResponse.json(
        {
          error:
            "Bot username is not set — add NEXT_PUBLIC_TELEGRAM_BOT_USERNAME so we can deep-link.",
          token: session.token,
          expiresAt: session.expiresAt,
        },
        { status: 503 },
      ),
      limitResult,
    );
  }

  return withRateLimitHeaders(
    NextResponse.json({
      ok: true,
      deepLink: session.deepLink,
      webDeepLink: session.webDeepLink,
      webhookRepaired: Boolean(webhook.repaired),
      expiresAt: session.expiresAt,
    }),
    limitResult,
  );
}

/** Disconnect this desk account from Telegram. */
export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request, true);
  if ("error" in auth && auth.error) return auth.error;
  const { user, limitResult } = auth as {
    user: NonNullable<(typeof auth)["user"]>;
    limitResult: NonNullable<(typeof auth)["limitResult"]>;
  };

  const removed = await unlinkTelegramForUser(user.id);
  return withRateLimitHeaders(
    NextResponse.json({ ok: true, removed }),
    limitResult,
  );
}
