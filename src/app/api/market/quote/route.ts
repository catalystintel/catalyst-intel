import { NextResponse, type NextRequest } from "next/server";

import { getCurrentAppUser } from "@/lib/auth/current-user";
import { fetchMarketQuoteBundle } from "@/lib/catalysts/enrich-article";
import { toTradingViewSymbol } from "@/lib/catalysts/enrich-article-format";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";

/**
 * Authenticated quote + profile for the Live tape split panel.
 * Query: `?symbol=AAPL`
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `market-quote:${ip}`,
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

  const { quote, profile } = await fetchMarketQuoteBundle({ symbol: raw });
  const symbol = (profile?.symbol ?? raw).toUpperCase();
  const tradingViewSymbol = toTradingViewSymbol(symbol, profile?.exchange);

  return withRateLimitHeaders(
    NextResponse.json({
      symbol,
      tradingViewSymbol,
      quote,
      profile,
    }),
    limitResult,
  );
}
