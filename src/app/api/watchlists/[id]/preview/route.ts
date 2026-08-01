import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { watchlists, type WatchlistCriteria } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { toFeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import {
  queryFeedPage,
  queryFeedTotal,
  type FeedQueryFilters,
} from "@/lib/catalysts/feed-query";
import { isFeedFormFilter } from "@/lib/catalysts/feed-form-filters";
import { isEventCategoryKey } from "@/lib/catalysts/taxonomy";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";

/** Small preview slice — this is a "does this look right?" check, not the tape. */
const PREVIEW_LIMIT = 8;

function criteriaToFeedFilters(
  criteria: WatchlistCriteria,
  nowIso: string,
): FeedQueryFilters {
  return {
    q: criteria.q ?? "",
    symbols: (criteria.symbols ?? []).map((s) => s.toUpperCase()),
    categories: (criteria.categories ?? []).filter(isEventCategoryKey),
    sectors: [],
    forms: (criteria.forms ?? []).filter(isFeedFormFilter),
    sources: (criteria.sources ?? []).map((s) => s.toLowerCase()),
    tags: (criteria.tags ?? []).map((t) => t.toLowerCase()),
    timeWindow: "all",
    symbolOnly: true,
    earningsSurprisesOnly: false,
    since: null,
    until: nowIso,
  };
}

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
    queryFeedPage(filters, { limit: PREVIEW_LIMIT }),
    queryFeedTotal(filters),
  ]);

  return withRateLimitHeaders(
    NextResponse.json({
      total,
      catalysts: rows.map(toFeedCatalyst),
    }),
    limitResult,
  );
}
