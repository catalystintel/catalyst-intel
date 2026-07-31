import { NextResponse, type NextRequest } from "next/server";
import { asc, like, or, sql } from "drizzle-orm";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { nyseListings } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";
import { escapeLike } from "@/lib/db/escape-like";
import { isFinnhubConfigured } from "@/lib/jobs/finnhub-env";

/**
 * Authenticated NYSE listing search for watchlist / desk enrichment.
 * Soft empty state when Finnhub key missing or universe not yet ingested.
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
    key: `nyse-symbols:${ip}`,
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

  const configured = isFinnhubConfigured();
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().toUpperCase();
  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "40");
  const limit = Number.isFinite(limitParam)
    ? Math.min(100, Math.max(1, Math.floor(limitParam)))
    : 40;

  const countRow = await db
    .select({ value: sql<number>`count(*)` })
    .from(nyseListings)
    .get();
  const total = Number(countRow?.value ?? 0);

  if (total === 0) {
    return withRateLimitHeaders(
      NextResponse.json({
        configured,
        total: 0,
        symbols: [],
        emptyReason: configured
          ? "No NYSE listings yet — an admin should run Finnhub NYSE fetch."
          : "Market data listings are not configured yet. Quotes stay empty until an admin enables them.",
      }),
      limitResult,
    );
  }

  const safeQ = escapeLike(q);
  const rows = q
    ? await db
        .select({
          symbol: nyseListings.symbol,
          displaySymbol: nyseListings.displaySymbol,
          description: nyseListings.description,
          lastPrice: nyseListings.lastPrice,
          quotedAt: nyseListings.quotedAt,
          mic: nyseListings.mic,
        })
        .from(nyseListings)
        .where(
          or(
            like(nyseListings.symbol, `${safeQ}%`),
            like(nyseListings.displaySymbol, `${safeQ}%`),
            like(nyseListings.description, `%${safeQ}%`),
          ),
        )
        .orderBy(asc(nyseListings.symbol))
        .limit(limit)
        .all()
    : await db
        .select({
          symbol: nyseListings.symbol,
          displaySymbol: nyseListings.displaySymbol,
          description: nyseListings.description,
          lastPrice: nyseListings.lastPrice,
          quotedAt: nyseListings.quotedAt,
          mic: nyseListings.mic,
        })
        .from(nyseListings)
        .orderBy(asc(nyseListings.symbol))
        .limit(limit)
        .all();

  return withRateLimitHeaders(
    NextResponse.json({
      configured,
      total,
      symbols: rows,
      emptyReason: null,
    }),
    limitResult,
  );
}
