import { NextResponse, type NextRequest } from "next/server";

import { getCurrentAppUser } from "@/lib/auth/current-user";
import { getClientIp } from "@/lib/http/client-ip";
import { getTrustedAppOrigin } from "@/lib/http/origin";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";
import {
  isSameOriginRequest,
  sameOriginForbiddenResponse,
} from "@/lib/http/same-origin";
import {
  getTelegramBotUsername,
  isTelegramConfigured,
  setupTelegramBot,
} from "@/lib/telegram/bot";

/**
 * Admin-only: register webhook, slash commands, description, and brand
 * profile photo for the Catalyst Intel Telegram bot.
 */
async function requireAdmin(
  request: NextRequest,
  options?: { mutate?: boolean },
) {
  if (options?.mutate && !isSameOriginRequest(request)) {
    return { error: sameOriginForbiddenResponse() };
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `admin-telegram-setup:${ip}`,
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

  if (!user.isAdmin) {
    return {
      error: withRateLimitHeaders(
        NextResponse.json({ error: "Admin only." }, { status: 403 }),
        limitResult,
      ),
    };
  }

  return { user, limitResult };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  const { limitResult } = auth as {
    limitResult: NonNullable<(typeof auth)["limitResult"]>;
  };

  const origin = getTrustedAppOrigin(request);
  return withRateLimitHeaders(
    NextResponse.json({
      configured: isTelegramConfigured(),
      botUsername: getTelegramBotUsername() ?? null,
      webhookUrl: `${origin}/api/telegram/webhook`,
    }),
    limitResult,
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request, { mutate: true });
  if ("error" in auth && auth.error) return auth.error;
  const { limitResult } = auth as {
    limitResult: NonNullable<(typeof auth)["limitResult"]>;
  };

  const origin = getTrustedAppOrigin(request);
  const webhookUrl = `${origin}/api/telegram/webhook`;
  const report = await setupTelegramBot({ webhookUrl });

  return withRateLimitHeaders(
    NextResponse.json(
      {
        ...report,
        botUsername: report.bot?.username ?? getTelegramBotUsername() ?? null,
        ranAt: new Date().toISOString(),
      },
      { status: report.ok ? 200 : 502 },
    ),
    limitResult,
  );
}
