/**
 * Authenticated News Feed list — wire / company-news headlines only.
 * Soft-poll friendly; separate from Catalyst Feed's triage blotter.
 */

import { NextResponse, type NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";

import { databaseSetupHint, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { watchlistEntries } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import {
  encodeFeedCursor,
  NEWS_FEED_MAX_LIMIT,
  NEWS_FEED_PAGE_SIZE,
  parseFeedCursor,
  parseNewsFeedFilters,
  queryNewsFeedPage,
  queryNewsFeedTotal,
} from "@/lib/catalysts/news-feed-query";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";

export async function GET(request: NextRequest) {
  if (!isLibsqlConfigured()) {
    return NextResponse.json({ error: databaseSetupHint() }, { status: 503 });
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `news:${ip}`,
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

  const params = request.nextUrl.searchParams;
  const filters = parseNewsFeedFilters(params);

  if (params.get("watchlist") === "1") {
    const rows = await db
      .select({ symbol: watchlistEntries.symbol })
      .from(watchlistEntries)
      .where(eq(watchlistEntries.userId, user.id))
      .orderBy(asc(watchlistEntries.symbol))
      .all();
    filters.symbols = rows.map((r) => r.symbol);
    if (filters.symbols.length === 0) {
      return withRateLimitHeaders(
        NextResponse.json({
          headlines: [],
          total: 0,
          nextCursor: null,
          fetchedAt: new Date().toISOString(),
        }),
        limitResult,
      );
    }
  }

  const cursor = parseFeedCursor(params.get("cursor"));
  const limitParam = Number(params.get("limit") ?? String(NEWS_FEED_PAGE_SIZE));
  const limit = Number.isFinite(limitParam)
    ? Math.min(NEWS_FEED_MAX_LIMIT, Math.max(1, Math.floor(limitParam)))
    : NEWS_FEED_PAGE_SIZE;

  const [headlines, total] = await Promise.all([
    queryNewsFeedPage(filters, { cursor, limit }),
    cursor ? Promise.resolve(null) : queryNewsFeedTotal(filters),
  ]);

  const last = headlines[headlines.length - 1];
  const nextCursor =
    headlines.length >= limit && last
      ? encodeFeedCursor({ timestamp: last.timestamp, id: last.id })
      : null;

  return withRateLimitHeaders(
    NextResponse.json({
      headlines,
      total,
      nextCursor,
      fetchedAt: new Date().toISOString(),
    }),
    limitResult,
  );
}
