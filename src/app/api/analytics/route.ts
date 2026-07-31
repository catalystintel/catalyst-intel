import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { catalysts, companies } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { buildAnalyticsSummary } from "@/lib/catalysts/analytics";
import {
  parseAnalyticsWindow,
  sinceIsoForAnalyticsWindow,
} from "@/lib/catalysts/analytics-window";
import { withDbRetry } from "@/lib/db/with-db-retry";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";

/**
 * Aggregated stats for the Analytics dashboard.
 *
 * Query params:
 * - `window` — 24h | 7d | 30d (default 24h)
 *
 * Aggregation happens in `buildAnalyticsSummary` (plain JS, not SQL
 * `GROUP BY`) since the row count in any of these windows is small enough
 * that a single indexed range scan + in-memory aggregation is simpler and
 * easier to evolve than several grouped queries, while still being cheap.
 */
export async function GET(request: NextRequest) {
  if (!isLibsqlConfigured()) {
    return NextResponse.json(
      { error: databaseUnavailableMessage() },
      { status: 503 },
    );
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `analytics:${ip}`,
    ...RATE_LIMITS.analyticsRead,
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

  const window = parseAnalyticsWindow(
    request.nextUrl.searchParams.get("window"),
  );
  const since = sinceIsoForAnalyticsWindow(window);
  const now = new Date().toISOString();

  const rows = await withDbRetry(() =>
    db
      .select({
        symbol: catalysts.symbol,
        eventCategory: catalysts.eventCategory,
        impactScore: catalysts.impactScore,
        timestamp: catalysts.timestamp,
        sector: companies.sector,
      })
      .from(catalysts)
      .leftJoin(companies, eq(catalysts.companyId, companies.id))
      .where(
        and(gte(catalysts.timestamp, since), lte(catalysts.timestamp, now)),
      )
      .all(),
  );

  const summary = buildAnalyticsSummary(rows, window);

  return withRateLimitHeaders(
    NextResponse.json({
      window,
      since,
      fetchedAt: new Date().toISOString(),
      summary,
    }),
    limitResult,
  );
}
