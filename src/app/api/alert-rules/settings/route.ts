import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { alertRules } from "@/db/schema";
import {
  isSmtpConfigured,
  isTelegramConfigured,
  isWebPushConfigured,
} from "@/lib/alerts/deliver";
import { normalizeAlertConditions } from "@/lib/alerts/normalize";
import {
  deriveNotificationSettings,
  parseNotificationSettingsBody,
} from "@/lib/alerts/settings-model";
import { syncNotificationSettings } from "@/lib/alerts/settings-sync";
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
import {
  getTelegramLinkByUserId,
  isTelegramLinkMuted,
} from "@/lib/telegram/link";

/**
 * Simplified notifications settings: enable methods + attach watchlists.
 * Persists as one managed `alert_rules` row per enabled channel.
 */
export async function PUT(request: NextRequest) {
  if (!isLibsqlConfigured()) {
    return NextResponse.json(
      { error: databaseUnavailableMessage() },
      { status: 503 },
    );
  }

  if (!isSameOriginRequest(request)) {
    return sameOriginForbiddenResponse();
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `alert-settings:${ip}`,
    ...RATE_LIMITS.userWrite,
  });
  if (!limitResult.ok) return rateLimitExceededResponse(limitResult);

  const user = await getCurrentAppUser();
  if (!user) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
      limitResult,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
      limitResult,
    );
  }

  const parsed = parseNotificationSettingsBody(body);
  if (!parsed.ok) {
    return withRateLimitHeaders(
      NextResponse.json({ error: parsed.error }, { status: 400 }),
      limitResult,
    );
  }

  if (parsed.settings.channels.push && !isWebPushConfigured()) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "Push isn’t available on this deployment." },
        { status: 400 },
      ),
      limitResult,
    );
  }
  if (parsed.settings.channels.telegram && !isTelegramConfigured()) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "Telegram isn’t configured on this deployment." },
        { status: 400 },
      ),
      limitResult,
    );
  }
  if (parsed.settings.channels.email && !isSmtpConfigured()) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "Email isn’t configured on this deployment." },
        { status: 400 },
      ),
      limitResult,
    );
  }

  try {
    const settings = await syncNotificationSettings({
      userId: user.id,
      email: user.email,
      settings: parsed.settings,
      telegramChatId: parsed.telegramChatId,
    });

    const rows = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.userId, user.id))
      .all();
    const link = await getTelegramLinkByUserId(user.id);

    return withRateLimitHeaders(
      NextResponse.json({
        ok: true,
        settings: deriveNotificationSettings(
          rows.map((r) => ({
            channel: r.channel,
            enabled: Boolean(r.enabled),
            conditions: normalizeAlertConditions(r.conditions),
          })),
        ),
        saved: settings,
        rules: rows.map((r) => ({
          id: r.id,
          name: r.name,
          channel: r.channel,
          enabled: Boolean(r.enabled),
        })),
        telegramLinked: link
          ? {
              chatId: link.chatId,
              username: link.username,
              muted: isTelegramLinkMuted(link),
              mutedUntil: link.mutedUntil,
              linkedAt: link.linkedAt,
            }
          : null,
      }),
      limitResult,
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not save notifications.";
    return withRateLimitHeaders(
      NextResponse.json({ error: message }, { status: 400 }),
      limitResult,
    );
  }
}
