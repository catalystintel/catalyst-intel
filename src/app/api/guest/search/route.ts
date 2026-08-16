/**
 * Guest landing search: rate-limited look up of recent catalysts by symbol.
 * Caps free lookups with an HMAC-signed count cookie so demos stay honest.
 */

import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, like, or, sql } from "drizzle-orm";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { catalysts, companies, rawSources } from "@/db/schema";
import { normalizeSymbol } from "@/lib/alerts/normalize";
import { feedSelectFields } from "@/lib/catalysts/feed-query";
import { toPublicFeedCatalyst } from "@/lib/catalysts/public-catalyst";
import { getClientIp } from "@/lib/http/client-ip";
import {
  GUEST_SEARCH_COOKIE,
  GUEST_SEARCH_COOKIE_MAX_AGE_SEC,
  GUEST_SEARCH_LIMIT,
  readGuestSearchCount,
  writeGuestSearchCount,
} from "@/lib/http/guest-search-cookie";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";

export { GUEST_SEARCH_COOKIE, GUEST_SEARCH_LIMIT };

export async function GET(request: NextRequest) {
  if (!isLibsqlConfigured()) {
    return NextResponse.json(
      { error: databaseUnavailableMessage() },
      { status: 503 },
    );
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `guest-search:${ip}`,
    ...RATE_LIMITS.guestSearch,
  });
  if (!limitResult.ok) {
    return rateLimitExceededResponse(limitResult);
  }

  const qRaw = request.nextUrl.searchParams.get("q") ?? "";
  const symbol = normalizeSymbol(qRaw);
  if (!symbol) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "Enter a valid ticker symbol (e.g. NVDA)." },
        { status: 400 },
      ),
      limitResult,
    );
  }

  const used = readGuestSearchCount(
    request.cookies.get(GUEST_SEARCH_COOKIE)?.value,
  );
  if (used >= GUEST_SEARCH_LIMIT) {
    return withRateLimitHeaders(
      NextResponse.json(
        {
          error: "free_limit",
          message: `Free preview is limited to ${GUEST_SEARCH_LIMIT} searches. Sign in for the full Live tape.`,
          remaining: 0,
          limit: GUEST_SEARCH_LIMIT,
        },
        { status: 429 },
      ),
      limitResult,
    );
  }

  const pattern = `${symbol}%`;
  const rows = await db
    .select(feedSelectFields)
    .from(catalysts)
    .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
    .leftJoin(companies, eq(catalysts.companyId, companies.id))
    .where(
      and(
        or(eq(catalysts.symbol, symbol), like(catalysts.symbol, pattern))!,
        sql`${catalysts.timestamp} <= ${new Date().toISOString()}`,
      ),
    )
    .orderBy(desc(catalysts.timestamp), desc(catalysts.id))
    .limit(5)
    .all();

  const remaining = Math.max(0, GUEST_SEARCH_LIMIT - used - 1);
  const response = withRateLimitHeaders(
    NextResponse.json({
      symbol,
      remaining,
      limit: GUEST_SEARCH_LIMIT,
      results: rows.map((r) => {
        const pub = toPublicFeedCatalyst(r);
        return {
          id: pub.id,
          symbol: pub.symbol,
          title: pub.title,
          category: pub.eventCategory,
          timestamp: pub.timestamp,
          summary: pub.summary,
        };
      }),
    }),
    limitResult,
  );

  response.cookies.set(GUEST_SEARCH_COOKIE, writeGuestSearchCount(used + 1), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_SEARCH_COOKIE_MAX_AGE_SEC,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
