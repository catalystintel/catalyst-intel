import { NextResponse, type NextRequest } from "next/server";
import { desc } from "drizzle-orm";

import { LIBSQL_SETUP_HINT, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { catalysts } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";

/**
 * Authenticated catalyst list for the Live feed soft-refetch.
 * Rate-limited per IP (loose) so focus-aware polling stays safe.
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
      type: catalysts.type,
      title: catalysts.title,
      timestamp: catalysts.timestamp,
    })
    .from(catalysts)
    .orderBy(desc(catalysts.timestamp))
    .limit(limit)
    .all();

  return withRateLimitHeaders(
    NextResponse.json({
      catalysts: rows,
      fetchedAt: new Date().toISOString(),
    }),
    limitResult,
  );
}
