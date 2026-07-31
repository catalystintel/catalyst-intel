import { NextResponse, type NextRequest } from "next/server";

import { getCurrentAppUser } from "@/lib/auth/current-user";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";
import { DEFAULT_CHART_RANGE, isChartRangeKey } from "@/lib/market/chart-range";
import { fetchDeskCandles } from "@/lib/market/fetch-candles";

/**
 * Authenticated OHLC series for the desk Lightweight Charts blotter.
 * Query: `?symbol=AAPL&range=1D`
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `market-candles:${ip}`,
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

  const series = await fetchDeskCandles({
    symbol: raw,
    range: rangeRaw,
  });

  return withRateLimitHeaders(
    NextResponse.json({
      symbol: series.symbol,
      range: series.range,
      provider: series.provider,
      candles: series.candles,
    }),
    limitResult,
  );
}
