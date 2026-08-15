/**
 * Keyless Yahoo Finance chart + quote helpers for the desk blotter.
 * Soft-fails on network/parse errors. Used when Finnhub candles are paid-gated
 * and Polygon is unset — without this every chart shows empty SAMPLE.
 */

import {
  chartRangeWindow,
  isIntradayMinuteRange,
  type ChartRangeKey,
} from "@/lib/market/chart-range";
import type { DeskCandle } from "@/lib/market/fetch-candles";
import { toYahooSymbol } from "@/lib/market/vendor-symbol";
import { sessionMoveFromPreviousClose } from "@/lib/market/session-move";

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

type YahooQuoteBlock = {
  open?: Array<number | null>;
  high?: Array<number | null>;
  low?: Array<number | null>;
  close?: Array<number | null>;
};

type YahooChartResult = {
  meta?: {
    symbol?: string;
    regularMarketPrice?: number;
    chartPreviousClose?: number;
    previousClose?: number;
    regularMarketTime?: number;
    currency?: string;
  };
  timestamp?: number[];
  indicators?: {
    quote?: YahooQuoteBlock[];
  };
};

function yahooRangeParams(range: ChartRangeKey): {
  interval: string;
  range: string;
} {
  switch (range) {
    case "30m":
    case "1H":
      // Yahoo has no sub-day `range`; pull 1d of 1m bars and clip client-side.
      return { interval: "1m", range: "1d" };
    case "1D":
      // Weekend / holiday: 5d keeps the last session's 5m bars available.
      return { interval: "5m", range: "5d" };
    case "5D":
      return { interval: "60m", range: "5d" };
    case "1M":
      return { interval: "1d", range: "1mo" };
    case "3M":
      return { interval: "1d", range: "3mo" };
    case "6M":
      return { interval: "1d", range: "6mo" };
    case "YTD":
      return { interval: "1d", range: "ytd" };
    case "1Y":
      return { interval: "1wk", range: "1y" };
    case "5Y":
      return { interval: "1wk", range: "5y" };
    case "ALL":
      return { interval: "1mo", range: "max" };
    default:
      return { interval: "1d", range: "1mo" };
  }
}

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * For 1D we may pull 5d of 5m bars — keep only the last session day (UTC date
 * of the newest bar) so the area chart matches "today / last tape".
 */
function filterLastSession(
  candles: DeskCandle[],
  range: ChartRangeKey,
): DeskCandle[] {
  if (range !== "1D" || candles.length === 0) return candles;
  const last = candles[candles.length - 1]!;
  const day = new Date(last.time * 1000).toISOString().slice(0, 10);
  return candles.filter(
    (c) => new Date(c.time * 1000).toISOString().slice(0, 10) === day,
  );
}

export async function fetchYahooCandles(options: {
  symbol: string;
  range: ChartRangeKey;
  /**
   * When false, leave the multi-day 1D window intact so callers can read
   * prior-session close before clipping. Default true (session-only series).
   */
  clipToLastSession?: boolean;
}): Promise<DeskCandle[] | null> {
  const yahooSymbol = toYahooSymbol(options.symbol);
  if (!yahooSymbol) return null;
  const { interval, range } = yahooRangeParams(options.range);

  try {
    const url = new URL(`${YAHOO_CHART}/${encodeURIComponent(yahooSymbol)}`);
    url.searchParams.set("interval", interval);
    url.searchParams.set("range", range);
    url.searchParams.set("includePrePost", "false");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "catalyst-intel-desk/1.0",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      chart?: { result?: YahooChartResult[] | null; error?: unknown };
    };
    const result = payload.chart?.result?.[0];
    if (!result?.timestamp?.length) return null;
    const quote = result.indicators?.quote?.[0];
    if (!quote) return null;

    const candles: DeskCandle[] = [];
    for (let i = 0; i < result.timestamp.length; i++) {
      const time = result.timestamp[i];
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
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
    if (isIntradayMinuteRange(options.range)) {
      const { fromSec, toSec } = chartRangeWindow(options.range);
      const clipped = candles.filter(
        (c) => c.time >= fromSec && c.time <= toSec,
      );
      // Prefer live window; if empty (after-hours), keep full day so the
      // desk can trailing-clip relative to the newest bar.
      return clipped.length > 0 ? clipped : candles;
    }
    if (options.clipToLastSession === false) {
      return candles;
    }
    const filtered = filterLastSession(candles, options.range);
    return filtered.length > 0 ? filtered : candles;
  } catch {
    return null;
  }
}

export type YahooQuote = {
  price: number;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  asOf: string | null;
};

/**
 * Session quote from Yahoo chart meta (+ last bar OHLC when present).
 * Previous close comes from the prior daily bar — not `chartPreviousClose` on
 * multi-day ranges (that field is the close *before the range*, which made
 * 1D % look like a multi-day move).
 */
export async function fetchYahooQuote(
  symbol: string,
): Promise<YahooQuote | null> {
  const yahooSymbol = toYahooSymbol(symbol);
  if (!yahooSymbol) return null;

  try {
    const url = new URL(`${YAHOO_CHART}/${encodeURIComponent(yahooSymbol)}`);
    // Daily bars so we can take last close vs prior session close.
    url.searchParams.set("interval", "1d");
    url.searchParams.set("range", "5d");
    url.searchParams.set("includePrePost", "false");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "catalyst-intel-desk/1.0",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      chart?: { result?: YahooChartResult[] | null };
    };
    const result = payload.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta) return null;

    const quote = result?.indicators?.quote?.[0];
    const closes = quote?.close ?? [];
    const finiteCloses: number[] = [];
    const finiteIdx: number[] = [];
    for (let i = 0; i < closes.length; i++) {
      if (finite(closes[i])) {
        finiteCloses.push(closes[i]!);
        finiteIdx.push(i);
      }
    }

    const price =
      (finite(meta.regularMarketPrice) ? meta.regularMarketPrice : null) ??
      (finiteCloses.length > 0 ? finiteCloses[finiteCloses.length - 1]! : null);
    if (price == null || price <= 0) return null;

    // Prior session close = second-to-last daily bar.
    let previousClose: number | null =
      finiteCloses.length >= 2 ? finiteCloses[finiteCloses.length - 2]! : null;
    if (previousClose == null) {
      previousClose =
        (finite(meta.previousClose) ? meta.previousClose : null) ??
        (finite(meta.chartPreviousClose) ? meta.chartPreviousClose : null);
    }

    const lastIdx =
      finiteIdx.length > 0 ? finiteIdx[finiteIdx.length - 1]! : -1;
    const open =
      lastIdx >= 0 && finite(quote?.open?.[lastIdx])
        ? quote!.open![lastIdx]!
        : null;
    const high =
      lastIdx >= 0 && finite(quote?.high?.[lastIdx])
        ? quote!.high![lastIdx]!
        : null;
    const low =
      lastIdx >= 0 && finite(quote?.low?.[lastIdx])
        ? quote!.low![lastIdx]!
        : null;

    const move = sessionMoveFromPreviousClose(price, previousClose);

    return {
      price,
      change: move.change,
      changePercent: move.changePercent,
      open,
      high,
      low,
      previousClose,
      asOf:
        typeof meta.regularMarketTime === "number" && meta.regularMarketTime > 0
          ? new Date(meta.regularMarketTime * 1000).toISOString()
          : null,
    };
  } catch {
    return null;
  }
}

/** Closes/opens for range-performance without full OHLC objects. */
export async function fetchYahooCloseSeries(options: {
  symbol: string;
  range: ChartRangeKey;
}): Promise<{ opens: number[]; closes: number[] } | null> {
  const candles = await fetchYahooCandles(options);
  if (!candles || candles.length === 0) return null;
  return {
    opens: candles.map((c) => c.open),
    closes: candles.map((c) => c.close),
  };
}
