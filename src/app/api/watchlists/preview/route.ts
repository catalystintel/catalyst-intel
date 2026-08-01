import { NextResponse, type NextRequest } from "next/server";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { toFeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import { queryFeedPage, queryFeedTotal } from "@/lib/catalysts/feed-query";
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
import { criteriaToFeedFilters } from "@/lib/watchlist/criteria-to-feed-filters";
import { normalizeWatchlistCriteria } from "@/lib/watchlist/normalize-criteria";

/** Small preview slice — this is a "does this look right?" check, not the tape. */
const PREVIEW_LIMIT = 8;

/**
 * Ad-hoc preview for a watchlist that hasn't been saved yet — the builder
 * (manual editor + templates + AI draft) calls this on every edit so the
 * user sees match counts before committing.
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
      limitResult,
    );
  }
  const raw =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  const criteria = normalizeWatchlistCriteria(raw.criteria);
  if (Object.keys(criteria).length === 0) {
    return withRateLimitHeaders(
      NextResponse.json({ total: 0, catalysts: [] }),
      limitResult,
    );
  }

  const filters = criteriaToFeedFilters(criteria, new Date().toISOString());
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
