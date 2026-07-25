import { NextResponse, type NextRequest } from "next/server";

import { getCurrentAppUser } from "@/lib/auth/current-user";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";
import { DEFAULT_CHART_RANGE, isChartRangeKey } from "@/lib/market/chart-range";
import { fetchRangePerformance } from "@/lib/market/range-performance";

/**
 * Authenticated lookback performance for the Live tape chart header.
 * Query: `?symbol=AAPL&range=1M`
 *
 * `1D` is intentionally rejected — the split panel uses the session quote
 * for that window so we do not burn a candle call on every open.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `market-performance:${ip}`,
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

  const raw = request.nextUrl.searchParams.get("symbol")?.trim() ?? "";
  if (!raw || raw.length > 12) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Invalid symbol." }, { status: 400 }),
      limitResult,
    );
  }

  const rangeRaw =
    request.nextUrl.searchParams.get("range")?.trim().toUpperCase() ??
    DEFAULT_CHART_RANGE;
  if (!isChartRangeKey(rangeRaw)) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Invalid range." }, { status: 400 }),
      limitResult,
    );
  }
  if (rangeRaw === "1D") {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "Use session quote for 1D performance." },
        { status: 400 },
      ),
      limitResult,
    );
  }

  const performance = await fetchRangePerformance({
    ticker: raw,
    range: rangeRaw,
  });

  return withRateLimitHeaders(
    NextResponse.json({
      ticker: raw.toUpperCase(),
      ...performance,
    }),
    limitResult,
  );
}
