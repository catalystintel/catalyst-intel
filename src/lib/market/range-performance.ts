import {
  chartRangeWindow,
  finnhubResolutionForRange,
  polygonAggForRange,
  ymdUtc,
  type ChartRangeKey,
} from "@/lib/market/chart-range";
import { getFinnhubApiKey, getPolygonApiKey } from "@/lib/jobs/vendor-env";
import { toVendorBareSymbol } from "@/lib/market/vendor-symbol";
import { fetchYahooCloseSeries } from "@/lib/market/yahoo-market";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const POLYGON_BASE = "https://api.polygon.io";

export type RangePerformance = {
  range: ChartRangeKey;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  /** First close (or open) used as the range baseline. */
  baseline: number | null;
  provider: "finnhub" | "polygon" | "yahoo" | "session" | null;
};

type CandleSeries = {
  closes: number[];
  opens: number[];
};

function finite(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * Performance across a candle series: last close vs first open (fallback
 * first close). Matches how desk traders read a lookback move.
 */
export function performanceFromCandles(
  series: CandleSeries,
): Pick<RangePerformance, "price" | "change" | "changePercent" | "baseline"> {
  const { closes, opens } = series;
  if (closes.length === 0) {
    return { price: null, change: null, changePercent: null, baseline: null };
  }
  const price = closes[closes.length - 1]!;
  const baseline =
    finite(opens[0]) ??
    finite(closes[0]) ??
    (closes.length > 1 ? closes[0]! : null);
  if (baseline == null || baseline === 0 || !Number.isFinite(price)) {
    return { price, change: null, changePercent: null, baseline };
  }
  const change = price - baseline;
  const changePercent = (change / baseline) * 100;
  return {
    price,
    baseline,
    change: Number(change.toFixed(4)),
    changePercent: Number(changePercent.toFixed(3)),
  };
}

async function finnhubCandles(
  symbol: string,
  apiKey: string,
  range: ChartRangeKey,
  now: Date,
): Promise<CandleSeries | null> {
  const { fromSec, toSec } = chartRangeWindow(range, now);
  const resolution = finnhubResolutionForRange(range);
  try {
    const url = new URL(`${FINNHUB_BASE}/stock/candle`);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("resolution", resolution);
    url.searchParams.set("from", String(fromSec));
    url.searchParams.set("to", String(toSec));
    url.searchParams.set("token", apiKey);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return null;
    const row = (await res.json()) as {
      s?: string;
      c?: number[];
      o?: number[];
    };
    if (row.s !== "ok" || !Array.isArray(row.c) || row.c.length === 0) {
      return null;
    }
    return {
      closes: row.c.filter((n) => Number.isFinite(n)),
      opens: Array.isArray(row.o)
        ? row.o.filter((n) => Number.isFinite(n))
        : [],
    };
  } catch {
    return null;
  }
}

async function polygonCandles(
  symbol: string,
  apiKey: string,
  range: ChartRangeKey,
  now: Date,
): Promise<CandleSeries | null> {
  const { fromSec, toSec } = chartRangeWindow(range, now);
  const { multiplier, timespan } = polygonAggForRange(range);
  const from = ymdUtc(fromSec);
  const to = ymdUtc(toSec);
  try {
    const path = `/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${multiplier}/${timespan}/${from}/${to}`;
    const url = new URL(`${POLYGON_BASE}${path}`);
    url.searchParams.set("adjusted", "true");
    url.searchParams.set("sort", "asc");
    url.searchParams.set("limit", "50000");
    url.searchParams.set("apiKey", apiKey);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      results?: Array<{ o?: number; c?: number }>;
    };
    const bars = payload.results ?? [];
    if (bars.length === 0) return null;
    return {
      opens: bars
        .map((b) => b.o)
        .filter((n): n is number => Number.isFinite(n)),
      closes: bars
        .map((b) => b.c)
        .filter((n): n is number => Number.isFinite(n)),
    };
  } catch {
    return null;
  }
}

/**
 * Range performance for the split-panel quote header.
 * Prefer Finnhub candles; fall back to Polygon aggregates, then Yahoo.
 */
export async function fetchRangePerformance(options: {
  symbol: string;
  range: ChartRangeKey;
  now?: Date;
}): Promise<RangePerformance> {
  const symbol = toVendorBareSymbol(options.symbol);
  const range = options.range;
  const now = options.now ?? new Date();
  const empty: RangePerformance = {
    range,
    price: null,
    change: null,
    changePercent: null,
    baseline: null,
    provider: null,
  };
  if (!symbol) return empty;

  const finnhubKey = getFinnhubApiKey();
  if (finnhubKey) {
    const series = await finnhubCandles(symbol, finnhubKey, range, now);
    if (series) {
      return {
        range,
        provider: "finnhub",
        ...performanceFromCandles(series),
      };
    }
  }

  const polygonKey = getPolygonApiKey();
  if (polygonKey) {
    const series = await polygonCandles(symbol, polygonKey, range, now);
    if (series) {
      return {
        range,
        provider: "polygon",
        ...performanceFromCandles(series),
      };
    }
  }

  const yahoo = await fetchYahooCloseSeries({ symbol, range });
  if (yahoo && yahoo.closes.length > 0) {
    return {
      range,
      provider: "yahoo",
      ...performanceFromCandles(yahoo),
    };
  }

  return empty;
}
