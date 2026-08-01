import {
  chartRangeWindow,
  finnhubResolutionForRange,
  isIntradayMinuteRange,
  polygonAggForRange,
  ymdUtc,
  type ChartRangeKey,
} from "@/lib/market/chart-range";
import { getFinnhubApiKey, getPolygonApiKey } from "@/lib/jobs/vendor-env";
import { sessionMoveFromPreviousClose } from "@/lib/market/session-move";
import { toVendorBareSymbol } from "@/lib/market/vendor-symbol";
import { fetchYahooCandles } from "@/lib/market/yahoo-market";

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
  provider: "finnhub" | "polygon" | "yahoo" | "demo" | null;
  /**
   * Prior session's last close (for 1D header % vs previous close).
   * Null when unknown or not applicable to the selected range.
   */
  previousClose: number | null;
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
 * 1D fetches a multi-day window so weekends still hit a cash session — keep
 * only the newest UTC trading day so chart % stays a session move, not 5D.
 */
export function keepLastSessionCandles(
  candles: DeskCandle[],
  range: ChartRangeKey,
): DeskCandle[] {
  if (range !== "1D" || candles.length === 0) return candles;
  const last = candles[candles.length - 1]!;
  const day = new Date(last.time * 1000).toISOString().slice(0, 10);
  const filtered = candles.filter(
    (c) => new Date(c.time * 1000).toISOString().slice(0, 10) === day,
  );
  return filtered.length > 0 ? filtered : candles;
}

/**
 * Last close from the UTC day before the newest bar's session.
 * Call on the multi-day series *before* `keepLastSessionCandles`.
 */
export function previousCloseFromPriorSession(
  candles: DeskCandle[],
): number | null {
  if (candles.length === 0) return null;
  const last = candles[candles.length - 1]!;
  const lastDay = new Date(last.time * 1000).toISOString().slice(0, 10);
  let priorClose: number | null = null;
  for (const c of candles) {
    const day = new Date(c.time * 1000).toISOString().slice(0, 10);
    if (day < lastDay) {
      priorClose = c.close;
    }
  }
  return priorClose != null && Number.isFinite(priorClose) && priorClose > 0
    ? priorClose
    : null;
}

/**
 * Chart header Δ: 1D uses previous close (exchange convention); other ranges
 * use first open → last close of the visible lookback.
 */
export function chartHeaderMove(options: {
  range: ChartRangeKey;
  candles: DeskCandle[];
  previousClose?: number | null;
}): {
  price: number | null;
  change: number | null;
  changePercent: number | null;
} {
  const { range, candles, previousClose } = options;
  if (candles.length === 0) {
    return { price: null, change: null, changePercent: null };
  }
  const last = candles[candles.length - 1]!;
  const price = last.close;

  if (range === "1D") {
    const move = sessionMoveFromPreviousClose(price, previousClose);
    return { price, change: move.change, changePercent: move.changePercent };
  }

  const first = candles[0]!;
  const baseline = first.open;
  if (!Number.isFinite(baseline) || baseline === 0 || !Number.isFinite(price)) {
    return { price, change: null, changePercent: null };
  }
  const change = price - baseline;
  const changePercent = (change / baseline) * 100;
  if (!Number.isFinite(changePercent) || Math.abs(changePercent) > 200) {
    return { price, change: null, changePercent: null };
  }
  return {
    price,
    change: Number(change.toFixed(4)),
    changePercent: Number(changePercent.toFixed(3)),
  };
}

function finalizeSeries(options: {
  symbol: string;
  range: ChartRangeKey;
  candles: DeskCandle[];
  provider: DeskCandleSeries["provider"];
}): DeskCandleSeries {
  const previousClose =
    options.range === "1D"
      ? previousCloseFromPriorSession(options.candles)
      : null;
  return {
    symbol: options.symbol,
    range: options.range,
    candles: keepLastSessionCandles(options.candles, options.range),
    provider: options.provider,
    previousClose,
  };
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
 * Prefers Finnhub → Polygon → Yahoo (keyless). Demo candles are opt-in only
 * (tests / offline demos) — never the default, or we paint a fake +N% move
 * as if it were the ticker (see PFSA SAMPLE chart bug).
 *
 * Always strip TradingView `EXCHANGE:` prefixes before vendor calls.
 */
export async function fetchDeskCandles(options: {
  symbol: string;
  range: ChartRangeKey;
  now?: Date;
  /** When true, synthesize OHLC if vendors miss. Default false. */
  allowDemo?: boolean;
}): Promise<DeskCandleSeries> {
  const symbol = toVendorBareSymbol(options.symbol);
  const range = options.range;
  const now = options.now ?? new Date();
  const allowDemo = options.allowDemo === true;

  if (!symbol) {
    return {
      symbol: "",
      range,
      candles: allowDemo ? buildDemoCandles(range, now) : [],
      provider: allowDemo ? "demo" : null,
      previousClose: null,
    };
  }

  const finnhubKey = getFinnhubApiKey();
  if (finnhubKey) {
    const candles = await finnhubOhlc(symbol, finnhubKey, range, now);
    if (candles) {
      return finalizeSeries({
        symbol,
        range,
        candles,
        provider: "finnhub",
      });
    }
  }

  const polygonKey = getPolygonApiKey();
  if (polygonKey) {
    const candles = await polygonOhlc(symbol, polygonKey, range, now);
    if (candles) {
      return finalizeSeries({
        symbol,
        range,
        candles,
        provider: "polygon",
      });
    }
  }

  // Keep the multi-day 1D window so we can read prior-session close before clip.
  const yahooCandles = await fetchYahooCandles({
    symbol,
    range,
    clipToLastSession: false,
  });
  if (yahooCandles && yahooCandles.length > 0) {
    return finalizeSeries({
      symbol,
      range,
      candles: yahooCandles,
      provider: "yahoo",
    });
  }

  if (allowDemo) {
    return {
      symbol,
      range,
      candles: buildDemoCandles(range, now),
      provider: "demo",
      previousClose: null,
    };
  }

  return {
    symbol,
    range,
    candles: [],
    provider: null,
    previousClose: null,
  };
}
