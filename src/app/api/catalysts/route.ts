import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";

import { LIBSQL_SETUP_HINT, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { catalysts, companies, rawSources } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";
import { fetchSecEdgar } from "@/lib/jobs/fetch-sec-edgar";
import {
  markRefetchCompleted,
  markRefetchFailed,
  markRefetchTriggered,
  shouldTriggerBackgroundRefetch,
} from "@/lib/jobs/ingestion-freshness";
import { formatSecFetchError } from "@/lib/jobs/sec-edgar-http";

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
      companyName: catalysts.companyName,
      type: catalysts.type,
      title: catalysts.title,
      headline: catalysts.headline,
      eventCategory: catalysts.eventCategory,
      itemCodes: catalysts.itemCodes,
      timestamp: catalysts.timestamp,
      summary: catalysts.summary,
      impactScore: catalysts.impactScore,
      sourceUrl: rawSources.url,
      sourceProvider: rawSources.provider,
      sector: companies.sector,
    })
    .from(catalysts)
    .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
    .leftJoin(companies, eq(catalysts.companyId, companies.id))
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
 * `fetchSecEdgar({ mode: "background" })` as best-effort self-heal.
 * Never throws or blocks the response. GHA cron remains the primary ingest;
 * on Vercel, SEC (www.sec.gov / Akamai) often ETIMEDOUT from datacenter IPs,
 * so background mode uses a short AbortSignal timeout + failure cooldown.
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
  void fetchSecEdgar({ mode: "background" })
    .then(() => {
      markRefetchCompleted();
    })
    .catch((error: unknown) => {
      markRefetchFailed();
      console.warn(
        "Background SEC EDGAR refetch failed (best-effort; GHA cron is primary):",
        formatSecFetchError(error),
      );
    });
}
