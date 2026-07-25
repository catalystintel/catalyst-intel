/**
 * Authenticated catalyst list for the Live feed soft-refetch.
 * Supports faceted filters, server search, keyset pagination, and facet
 * counts over the full filtered corpus (not just the current page).
 */

import { NextResponse, type NextRequest } from "next/server";
import { desc } from "drizzle-orm";

import { databaseSetupHint, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { rawSources } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import {
  encodeFeedCursor,
  FEED_MAX_LIMIT,
  FEED_PAGE_SIZE,
  parseFeedCursor,
  parseFeedQueryFromSearchParams,
  queryFeedFacets,
  queryFeedPage,
  queryFeedTotal,
} from "@/lib/catalysts/feed-query";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";
import { isLocalDevUi } from "@/lib/dev/local-dev-ui";
import { fetchAllCatalystSources } from "@/lib/jobs/fetch-all-sources";
import {
  markRefetchCompleted,
  markRefetchFailed,
  markRefetchTriggered,
  shouldTriggerBackgroundRefetch,
} from "@/lib/jobs/ingestion-freshness";

export async function GET(request: NextRequest) {
  if (!isLibsqlConfigured()) {
    return NextResponse.json({ error: databaseSetupHint() }, { status: 503 });
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

  const filters = parseFeedQueryFromSearchParams(request.nextUrl.searchParams);
  // Vendor Source facet is local-dev only — ignore crafted `sources=` in deploy.
  if (!isLocalDevUi()) {
    filters.sources = [];
  }
  const cursor = parseFeedCursor(request.nextUrl.searchParams.get("cursor"));
  const limitParam = Number(
    request.nextUrl.searchParams.get("limit") ?? String(FEED_PAGE_SIZE),
  );
  const limit = Number.isFinite(limitParam)
    ? Math.min(FEED_MAX_LIMIT, Math.max(1, Math.floor(limitParam)))
    : FEED_PAGE_SIZE;

  const includeFacets =
    request.nextUrl.searchParams.get("facets") !== "0" && cursor == null;

  const [rows, total, facets, latestSource] = await Promise.all([
    queryFeedPage(filters, { cursor, limit }),
    cursor ? Promise.resolve(null) : queryFeedTotal(filters),
    includeFacets ? queryFeedFacets(filters) : Promise.resolve(null),
    db
      .select({ fetchedAt: rawSources.fetchedAt })
      .from(rawSources)
      .orderBy(desc(rawSources.fetchedAt))
      .limit(1)
      .get(),
  ]);

  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length >= limit && last
      ? encodeFeedCursor({ timestamp: last.timestamp, id: last.id })
      : null;

  const lastIngestedAt = latestSource?.fetchedAt
    ? new Date(latestSource.fetchedAt).toISOString()
    : null;

  triggerBackgroundRefetchIfStale(
    lastIngestedAt ? new Date(lastIngestedAt) : null,
  );

  const publicFacets =
    facets == null
      ? undefined
      : isLocalDevUi()
        ? facets
        : { ...facets, sources: [] };

  return withRateLimitHeaders(
    NextResponse.json({
      catalysts: rows,
      fetchedAt: new Date().toISOString(),
      lastIngestedAt,
      window: filters.timeWindow,
      since: filters.since,
      total: total ?? undefined,
      nextCursor,
      facets: publicFacets,
    }),
    limitResult,
  );
}

function triggerBackgroundRefetchIfStale(lastFetchedAt: Date | null): void {
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
        "Background multi-source refetch failed (best-effort; cron-job.org is primary):",
        error instanceof Error ? error.message : error,
      );
    });
}
