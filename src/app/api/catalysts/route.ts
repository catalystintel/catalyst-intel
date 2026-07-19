import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";

import { LIBSQL_SETUP_HINT, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { catalysts, rawSources } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";
import { fetchSecEdgar } from "@/lib/jobs/fetch-sec-edgar";
import {
  markRefetchTriggered,
  shouldTriggerBackgroundRefetch,
} from "@/lib/jobs/ingestion-freshness";

/**
 * Authenticated catalyst list for the Live feed soft-refetch.
 * Rate-limited per IP (loose) so focus-aware polling stays safe.
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

  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitParam)
    ? Math.min(100, Math.max(1, Math.floor(limitParam)))
    : 50;

  const rows = await db
    .select({
      id: catalysts.id,
      ticker: catalysts.ticker,
      type: catalysts.type,
      title: catalysts.title,
      timestamp: catalysts.timestamp,
      summary: catalysts.summary,
      impactScore: catalysts.impactScore,
      sourceUrl: rawSources.url,
    })
    .from(catalysts)
    .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
    .orderBy(desc(catalysts.timestamp))
    .limit(limit)
    .all();

  await triggerBackgroundRefetchIfStale();

  return withRateLimitHeaders(
    NextResponse.json({
      catalysts: rows,
      fetchedAt: new Date().toISOString(),
    }),
    limitResult,
  );
}

/**
 * Checks the most recent ingestion timestamp and, if stale, fires
 * `fetchSecEdgar()` in the background. Never throws or blocks the response -
 * `fetchSecEdgar()` dedupes by SEC accession number, so an overlapping run
 * (e.g. from concurrent requests) is safe, just wasteful; the cooldown in
 * `shouldTriggerBackgroundRefetch` keeps that rare.
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
  void fetchSecEdgar().catch((error: unknown) => {
    console.error("Background SEC EDGAR refetch failed:", error);
  });
}
