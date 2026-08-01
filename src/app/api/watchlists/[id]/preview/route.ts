import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { watchlists, type WatchlistCriteria } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { queryFeedPage, queryFeedTotal } from "@/lib/catalysts/feed-query";
import { toPublicFeedCatalyst } from "@/lib/catalysts/public-catalyst";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";
import { criteriaToFeedFilters } from "@/lib/watchlist/criteria-to-feed-filters";

/** Small preview slice — this is a "does this look right?" check, not the tape. */
export const WATCHLIST_PREVIEW_LIMIT = 8;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isLibsqlConfigured()) {
    return NextResponse.json(
      { error: databaseUnavailableMessage() },
      { status: 503 },
    );
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `watchlists-preview:${ip}`,
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

  const id = Number((await params).id);
  if (!Number.isFinite(id) || id <= 0) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Invalid id." }, { status: 400 }),
      limitResult,
    );
  }

  const row = await db
    .select()
    .from(watchlists)
    .where(and(eq(watchlists.id, id), eq(watchlists.userId, user.id)))
    .get();
  if (!row) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Watchlist not found." }, { status: 404 }),
      limitResult,
    );
  }

  const filters = criteriaToFeedFilters(
    (row.criteria ?? {}) as WatchlistCriteria,
    new Date().toISOString(),
  );
  const [rows, total] = await Promise.all([
    queryFeedPage(filters, { limit: WATCHLIST_PREVIEW_LIMIT }),
    queryFeedTotal(filters),
  ]);

  return withRateLimitHeaders(
    NextResponse.json({
      total,
      catalysts: rows.map(toPublicFeedCatalyst),
    }),
    limitResult,
  );
}
