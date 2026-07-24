import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";

import { LIBSQL_SETUP_HINT, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { catalysts, companies, rawSources } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import {
  feedLimitForTimeWindow,
  parseFeedTimeWindow,
  sinceIsoForFeedTimeWindow,
} from "@/lib/catalysts/feed-time-window";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";
import { fetchAllCatalystSources } from "@/lib/jobs/fetch-all-sources";
import {
  markRefetchCompleted,
  markRefetchFailed,
  markRefetchTriggered,
  shouldTriggerBackgroundRefetch,
} from "@/lib/jobs/ingestion-freshness";

const MAX_LIMIT = 500;

function parseSinceParam(raw: string | null): string | null {
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

/**
 * Authenticated catalyst list for the Live feed soft-refetch.
 * Rate-limited per IP (loose) so focus-aware polling stays safe.
 *
 * Query params:
 * - `window` — recent | 1h | 4h | 12h | 24h | all (filters by event
 *   occurrence `catalysts.timestamp`, never `createdAt`)
 * - `since` — ISO lower bound on event `timestamp` (overrides `window` when valid)
 * - `limit` — page size (default depends on window; max 500)
 *
 * Also acts as a self-healing ETL backstop: GitHub Actions cron is
 * best-effort and can drift far past its configured interval (see
 * DEPLOYMENT.md), so a stale read here kicks off a non-blocking refetch
 * instead of waiting on the next lucky cron tick.
 */
export async function GET(request: NextRequest) {
  if (!isLibsqlConfigured()) {
    return NextResponse.json({ error: LIBSQL_SETUP_HINT }, { status: 503 });
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `catalysts:${ip}`,
    ...RATE_LIMITS.catalystsRead,
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

  const timeWindow = parseFeedTimeWindow(
    request.nextUrl.searchParams.get("window"),
  );
  const since =
    parseSinceParam(request.nextUrl.searchParams.get("since")) ??
    sinceIsoForFeedTimeWindow(timeWindow);

  const defaultLimit = feedLimitForTimeWindow(timeWindow);
  const limitParam = Number(
    request.nextUrl.searchParams.get("limit") ?? String(defaultLimit),
  );
  const limit = Number.isFinite(limitParam)
    ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(limitParam)))
    : defaultLimit;

  const baseQuery = db
    .select({
      id: catalysts.id,
      ticker: catalysts.ticker,
      companyName: catalysts.companyName,
      type: catalysts.type,
      title: catalysts.title,
      headline: catalysts.headline,
      eventCategory: catalysts.eventCategory,
      subcategory: catalysts.subcategory,
      itemCodes: catalysts.itemCodes,
      timestamp: catalysts.timestamp,
      summary: catalysts.summary,
      impactScore: catalysts.impactScore,
      confidence: catalysts.confidence,
      tags: catalysts.tags,
      historicalImpact: catalysts.historicalImpact,
      sourceUrl: rawSources.url,
      sourceProvider: rawSources.provider,
      sector: companies.sector,
    })
    .from(catalysts)
    .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
    .leftJoin(companies, eq(catalysts.companyId, companies.id));

  // Calendar sources (macro-calendar, earnings/FDA calendars) store the
  // *scheduled* event date as `timestamp`, sometimes months out. Without an
  // upper bound, `ORDER BY timestamp DESC` always puts those ahead of real
  // breaking news - a Nov 2026 FOMC date would out-rank everything that
  // actually happened today. The Live tape only shows what has occurred.
  const now = new Date().toISOString();
  const rows = await baseQuery
    .where(
      since
        ? and(gte(catalysts.timestamp, since), lte(catalysts.timestamp, now))
        : lte(catalysts.timestamp, now),
    )
    .orderBy(desc(catalysts.timestamp))
    .limit(limit)
    .all();

  await triggerBackgroundRefetchIfStale();

  return withRateLimitHeaders(
    NextResponse.json({
      catalysts: rows,
      fetchedAt: new Date().toISOString(),
      window: timeWindow,
      since,
    }),
    limitResult,
  );
}

/**
 * Checks the most recent ingestion timestamp and, if stale, fires a light
 * multi-source refetch (SEC + Nasdaq halts) as best-effort self-heal.
 * Never throws or blocks the response. GHA cron remains the primary ingest.
 */
async function triggerBackgroundRefetchIfStale(): Promise<void> {
  const latestSource = await db
    .select({ fetchedAt: rawSources.fetchedAt })
    .from(rawSources)
    .orderBy(desc(rawSources.fetchedAt))
    .limit(1)
    .get();

  const lastFetchedAt = latestSource ? new Date(latestSource.fetchedAt) : null;
  if (!shouldTriggerBackgroundRefetch({ lastFetchedAt })) return;

  markRefetchTriggered();
  void fetchAllCatalystSources({
    sources: ["sec-edgar", "nasdaq-halts"],
  })
    .then(() => {
      markRefetchCompleted();
    })
    .catch((error: unknown) => {
      markRefetchFailed();
      console.warn(
        "Background multi-source refetch failed (best-effort; GHA cron is primary):",
        error instanceof Error ? error.message : error,
      );
    });
}
