import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import {
  alertRules,
  catalysts,
  pushSubscriptions,
  rawSources,
  watchlistEntries,
  watchlists,
  type WatchlistCriteria,
} from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import {
  deliverAlertRules,
  type AlertWatchlistCriteriaById,
  type DeliverableRule,
} from "@/lib/alerts/deliver";
import { normalizeAlertConditions } from "@/lib/alerts/normalize";
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
import { getTelegramLinkByUserId } from "@/lib/telegram/link";

/**
 * Test-fires alert rules against the latest catalyst (or a specific id).
 * Fires only the caller's own rules.
 */
export async function POST(request: NextRequest) {
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
    key: `alert-test:${ip}`,
    ...RATE_LIMITS.alertTest,
  });
  if (!limitResult.ok) {
    return rateLimitExceededResponse(limitResult);
  }

  const user = await getCurrentAppUser();
  if (!user) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
      limitResult,
    );
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const raw =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  const ruleId =
    typeof raw.ruleId === "number"
      ? raw.ruleId
      : typeof raw.ruleId === "string"
        ? Number(raw.ruleId)
        : null;
  const catalystId =
    typeof raw.catalystId === "number"
      ? raw.catalystId
      : typeof raw.catalystId === "string"
        ? Number(raw.catalystId)
        : null;
  const force = raw.force !== false;

  const catalystSelect = {
    id: catalysts.id,
    symbol: catalysts.symbol,
    headline: catalysts.headline,
    title: catalysts.title,
    eventCategory: catalysts.eventCategory,
    impactScore: catalysts.impactScore,
    timestamp: catalysts.timestamp,
    type: catalysts.type,
    companyName: catalysts.companyName,
    summary: catalysts.summary,
    aiBullets: catalysts.aiBullets,
    sourceUrl: rawSources.url,
    sourceProvider: rawSources.provider,
    tags: catalysts.tags,
  };

  const catalystRow = catalystId
    ? await db
        .select(catalystSelect)
        .from(catalysts)
        .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
        .where(eq(catalysts.id, catalystId))
        .get()
    : await db
        .select(catalystSelect)
        .from(catalysts)
        .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
        .orderBy(desc(catalysts.timestamp))
        .limit(1)
        .get();

  if (!catalystRow) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "No catalyst available to test against." },
        { status: 404 },
      ),
      limitResult,
    );
  }

  let ruleRows = await db
    .select()
    .from(alertRules)
    .where(eq(alertRules.userId, user.id))
    .all();

  if (ruleId && Number.isFinite(ruleId)) {
    ruleRows = ruleRows.filter((r) => r.id === ruleId);
  }

  if (ruleRows.length === 0) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "No matching alert rules to fire." },
        { status: 404 },
      ),
      limitResult,
    );
  }

  const linked = await getTelegramLinkByUserId(user.id);
  const deliverable: DeliverableRule[] = ruleRows
    .filter((r) => r.enabled)
    .map((r) => ({
      id: r.id,
      name: r.name,
      channel: r.channel,
      webhookUrl: r.webhookUrl,
      emailTo: r.emailTo,
      telegramChatId: r.telegramChatId?.trim() || linked?.chatId || null,
      conditions: normalizeAlertConditions(r.conditions),
    }));

  const needsFlatSymbols = deliverable.some(
    (r) => r.conditions.watchlistOnly === true,
  );
  const needsSavedWatchlists = deliverable.some(
    (r) => (r.conditions.watchlistIds?.length ?? 0) > 0,
  );

  const flatSymbolRows = needsFlatSymbols
    ? await db
        .select({ symbol: watchlistEntries.symbol })
        .from(watchlistEntries)
        .where(eq(watchlistEntries.userId, user.id))
        .all()
    : [];

  const watchlistCriteriaById: AlertWatchlistCriteriaById | undefined =
    needsSavedWatchlists
      ? new Map(
          (
            await db
              .select({
                id: watchlists.id,
                criteria: watchlists.criteria,
              })
              .from(watchlists)
              .where(eq(watchlists.userId, user.id))
              .all()
          ).map((row) => [row.id, (row.criteria ?? {}) as WatchlistCriteria]),
        )
      : undefined;

  const userPushSubscriptions = deliverable.some((r) => r.channel === "push")
    ? await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, user.id))
        .all()
    : [];

  const results = await deliverAlertRules({
    catalyst: {
      ...catalystRow,
      tags: Array.isArray(catalystRow.tags)
        ? (catalystRow.tags as unknown[]).filter(
            (t): t is string => typeof t === "string",
          )
        : null,
      aiBullets: Array.isArray(catalystRow.aiBullets)
        ? (catalystRow.aiBullets as unknown[]).filter(
            (t): t is string => typeof t === "string",
          )
        : null,
    },
    rules: deliverable,
    force,
    watchlistSymbols: flatSymbolRows.map((r) => r.symbol),
    watchlistCriteriaById,
    pushSubscriptions: userPushSubscriptions,
    onDeadPushSubscription: async (endpoint) => {
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.endpoint, endpoint))
        .run();
    },
  });

  return withRateLimitHeaders(
    NextResponse.json({
      catalystId: catalystRow.id,
      results,
    }),
    limitResult,
  );
}
