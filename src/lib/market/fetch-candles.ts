import {
  chartRangeWindow,
  finnhubResolutionForRange,
  isIntradayMinuteRange,
  polygonAggForRange,
  ymdUtc,
  type ChartRangeKey,
} from "@/lib/market/chart-range";
import { getFinnhubApiKey, getPolygonApiKey } from "@/lib/jobs/vendor-env";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const POLYGON_BASE = "https://api.polygon.io";

/** One OHLC bar for Lightweight Charts (time is Unix seconds). */
export type DeskCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type DeskCandleSeries = {
  symbol: string;
  range: ChartRangeKey;
  candles: DeskCandle[];
  provider: "finnhub" | "polygon" | "demo";
};

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Polygon day-bounded aggs can overshoot short windows — clip to [from, to]. */
export function clipCandlesToWindow(
  candles: DeskCandle[],
  fromSec: number,
  toSec: number,
): DeskCandle[] {
  const clipped = candles.filter((c) => c.time >= fromSec && c.time <= toSec);
  return clipped.length > 0 ? clipped : candles;
}

/**
 * Deterministic demo OHLC so the blotter chart still renders without vendor
 * keys (local/CI). Not shown as live market data in the UI label.
 */
export function buildDemoCandles(
  range: ChartRangeKey,
  now = new Date(),
): DeskCandle[] {
  const { fromSec, toSec } = chartRangeWindow(range, now);
  const span = Math.max(toSec - fromSec, 60);
  const points = isIntradayMinuteRange(range)
    ? Math.max(Math.min(Math.floor(span / 60) + 1, 60), 1)
    : range === "1D"
      ? 78
      : range === "5D"
        ? 40
        : range === "1M"
          ? 31
          : 60;
  const step = isIntradayMinuteRange(range)
    ? 60
    : Math.max(Math.floor(span / points), 60);
  const out: DeskCandle[] = [];
  let price = 100;
  for (let t = fromSec; t <= toSec && out.length < points; t += step) {
    const drift = Math.sin(out.length / 5) * 1.2 + out.length * 0.08;
    const open = price;
    const close = Math.max(
      1,
      open + drift + (out.length % 3 === 0 ? -0.6 : 0.9),
    );
    const high = Math.max(open, close) + 0.45;
    const low = Math.min(open, close) - 0.4;
    out.push({
      time: t,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
    });
    price = close;
  }
  return out;
}

async function finnhubOhlc(
  symbol: string,
  apiKey: string,
  range: ChartRangeKey,
  now: Date,
): Promise<DeskCandle[] | null> {
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
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const row = (await res.json()) as {
      s?: string;
      t?: number[];
      o?: number[];
      h?: number[];
      l?: number[];
      c?: number[];
    };
    if (row.s !== "ok" || !Array.isArray(row.t) || row.t.length === 0) {
      return null;
    }
    const candles: DeskCandle[] = [];
    for (let i = 0; i < row.t.length; i++) {
      const time = row.t[i];
      const open = row.o?.[i];
      const high = row.h?.[i];
      const low = row.l?.[i];
      const close = row.c?.[i];
      if (
        !finite(time) ||
        !finite(open) ||
        !finite(high) ||
        !finite(low) ||
        !finite(close)
      ) {
        continue;
      }
      candles.push({ time, open, high, low, close });
    }
    if (candles.length === 0) return null;
    return clipCandlesToWindow(candles, fromSec, toSec);
  } catch {
    return null;
  }
}

async function polygonOhlc(
  symbol: string,
  apiKey: string,
  range: ChartRangeKey,
  now: Date,
): Promise<DeskCandle[] | null> {
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
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      results?: Array<{
        t?: number;
        o?: number;
        h?: number;
        l?: number;
        c?: number;
      }>;
    };
    const bars = payload.results ?? [];
    if (bars.length === 0) return null;
    const candles: DeskCandle[] = [];
    for (const b of bars) {
      if (
        !finite(b.t) ||
        !finite(b.o) ||
        !finite(b.h) ||
        !finite(b.l) ||
        !finite(b.c)
      ) {
        continue;
      }
      // Polygon `t` is milliseconds.
      candles.push({
        time: Math.floor(b.t / 1000),
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
      });
    }
    if (candles.length === 0) return null;
    return clipCandlesToWindow(candles, fromSec, toSec);
  } catch {
    return null;
  }
}

/**
 * OHLC for the desk Lightweight Charts blotter.
 * Prefers Finnhub → Polygon. Demo candles are opt-in only (tests / offline
 * demos) — never the default, or we paint a fake +N% move as if it were the
 * ticker (see PFSA SAMPLE chart bug).
 */
export async function fetchDeskCandles(options: {
  symbol: string;
  range: ChartRangeKey;
  now?: Date;
  /** When true, synthesize OHLC if vendors miss. Default false. */
  allowDemo?: boolean;
}): Promise<DeskCandleSeries> {
  const symbol = options.symbol.trim().toUpperCase();
  const range = options.range;
  const now = options.now ?? new Date();
  const allowDemo = options.allowDemo === true;

  if (!symbol) {
    return {
      symbol: "",
      range,
      candles: allowDemo ? buildDemoCandles(range, now) : [],
      provider: "demo",
    };
  }

  const finnhubKey = getFinnhubApiKey();
  if (finnhubKey) {
    const candles = await finnhubOhlc(symbol, finnhubKey, range, now);
    if (candles) {
      return { symbol, range, candles, provider: "finnhub" };
    }
  }

  const polygonKey = getPolygonApiKey();
  if (polygonKey) {
    const candles = await polygonOhlc(symbol, polygonKey, range, now);
    if (candles) {
      return { symbol, range, candles, provider: "polygon" };
    }
  }

  return {
    symbol,
    range,
    candles: allowDemo ? buildDemoCandles(range, now) : [],
    provider: "demo",
  };
}
