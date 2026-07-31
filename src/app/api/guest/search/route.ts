/**
 * Guest landing search: rate-limited look up of recent catalysts by symbol.
 * Caps free lookups with a signed-count cookie so demos stay honest.
 */

import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, like, or, sql } from "drizzle-orm";

import { databaseSetupHint, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { catalysts, rawSources } from "@/db/schema";
import { normalizeSymbol } from "@/lib/alerts/normalize";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";

export const GUEST_SEARCH_LIMIT = 3;
export const GUEST_SEARCH_COOKIE = "ci.guest-search";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 1 week

function readGuestCount(request: NextRequest): number {
  const raw = request.cookies.get(GUEST_SEARCH_COOKIE)?.value ?? "0";
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function GET(request: NextRequest) {
  if (!isLibsqlConfigured()) {
    return NextResponse.json({ error: databaseSetupHint() }, { status: 503 });
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

  const used = readGuestCount(request);
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
    .select({
      id: catalysts.id,
      symbol: catalysts.symbol,
      title: catalysts.title,
      headline: catalysts.headline,
      eventCategory: catalysts.eventCategory,
      timestamp: catalysts.timestamp,
      summary: catalysts.summary,
    })
    .from(catalysts)
    .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
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
      results: rows.map((r) => ({
        id: r.id,
        symbol: r.symbol,
        title: r.headline?.trim() || r.title,
        category: r.eventCategory,
        timestamp: r.timestamp,
        summary: r.summary,
      })),
    }),
    limitResult,
  );

  response.cookies.set(GUEST_SEARCH_COOKIE, String(used + 1), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SEC,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
