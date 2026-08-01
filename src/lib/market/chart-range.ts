/**
 * Desk-owned chart lookback windows. TradingView's free widgetembed does not
 * expose range-change events, so we drive interval + performance % ourselves.
 */

export const CHART_RANGE_KEYS = [
  "1m",
  "5m",
  "10m",
  "30m",
  "1H",
  "1D",
  "5D",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
  "5Y",
  "ALL",
] as const;

export type ChartRangeKey = (typeof CHART_RANGE_KEYS)[number];

export const DEFAULT_CHART_RANGE: ChartRangeKey = "1D";

/** TradingView widgetembed `interval` codes. */
export type TradingViewInterval =
  "1" | "5" | "15" | "30" | "60" | "D" | "W" | "M";

export type ChartRangeDef = {
  key: ChartRangeKey;
  label: string;
  /** Widget / vendor candle size for the selected lookback. */
  interval: TradingViewInterval;
  /**
   * Approximate calendar days for candle fetch. `null` when
   * `lookbackMinutes` is set, or for unbounded / long history (capped
   * server-side). YTD is computed from Jan 1.
   */
  lookbackDays: number | null;
  /** Intraday lookback in minutes (takes precedence over `lookbackDays`). */
  lookbackMinutes: number | null;
};

export const CHART_RANGES: readonly ChartRangeDef[] = [
  // Short windows use 1-minute bars so catalyst reaction is readable.
  {
    key: "1m",
    label: "1m",
    interval: "1",
    lookbackDays: null,
    lookbackMinutes: 1,
  },
  {
    key: "5m",
    label: "5m",
    interval: "1",
    lookbackDays: null,
    lookbackMinutes: 5,
  },
  {
    key: "10m",
    label: "10m",
    interval: "1",
    lookbackDays: null,
    lookbackMinutes: 10,
  },
  {
    key: "30m",
    label: "30m",
    interval: "1",
    lookbackDays: null,
    lookbackMinutes: 30,
  },
  {
    key: "1H",
    label: "1H",
    interval: "1",
    lookbackDays: null,
    lookbackMinutes: 60,
  },
  // 5 calendar days so weekends/holidays still cover the last US cash session
  // for Finnhub/Polygon 5-minute bars (Yahoo uses its own range param).
  {
    key: "1D",
    label: "1D",
    interval: "5",
    lookbackDays: 5,
    lookbackMinutes: null,
  },
  {
    key: "5D",
    label: "5D",
    interval: "60",
    lookbackDays: 5,
    lookbackMinutes: null,
  },
  {
    key: "1M",
    label: "1M",
    interval: "D",
    lookbackDays: 31,
    lookbackMinutes: null,
  },
  {
    key: "3M",
    label: "3M",
    interval: "D",
    lookbackDays: 93,
    lookbackMinutes: null,
  },
  {
    key: "6M",
    label: "6M",
    interval: "D",
    lookbackDays: 186,
    lookbackMinutes: null,
  },
  {
    key: "YTD",
    label: "YTD",
    interval: "D",
    lookbackDays: null,
    lookbackMinutes: null,
  },
  {
    key: "1Y",
    label: "1Y",
    interval: "W",
    lookbackDays: 365,
    lookbackMinutes: null,
  },
  {
    key: "5Y",
    label: "5Y",
    interval: "W",
    lookbackDays: 365 * 5,
    lookbackMinutes: null,
  },
  {
    key: "ALL",
    label: "All",
    interval: "M",
    lookbackDays: null,
    lookbackMinutes: null,
  },
] as const;

export function isChartRangeKey(raw: string): raw is ChartRangeKey {
  return (CHART_RANGES as readonly ChartRangeDef[]).some((r) => r.key === raw);
}

/**
 * Parse a `range` query/param. Exact match first so `1m` (minutes) and `1M`
 * (month) never collapse. Case-insensitive only when a single key matches.
 */
export function parseChartRangeKey(
  raw: string | null | undefined,
): ChartRangeKey | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isChartRangeKey(trimmed)) return trimmed;
  const lowered = trimmed.toLowerCase();
  const matches = CHART_RANGE_KEYS.filter((k) => k.toLowerCase() === lowered);
  if (matches.length === 1) return matches[0]!;
  return null;
}

export function chartRangeDef(key: ChartRangeKey): ChartRangeDef {
  return CHART_RANGES.find((r) => r.key === key) ?? CHART_RANGES[0]!;
}

/** Sub-day lookbacks (1m–1H). */
export function isIntradayMinuteRange(key: ChartRangeKey): boolean {
  const mins = chartRangeDef(key).lookbackMinutes;
  return mins != null && mins > 0;
}

/** Area series for fast scan on short / session windows. */
export function chartUsesAreaSeries(key: ChartRangeKey): boolean {
  return key === "1D" || isIntradayMinuteRange(key);
}

/** Show clock time on the x-axis for intraday panes. */
export function chartTimeVisible(key: ChartRangeKey): boolean {
  return key === "1D" || key === "5D" || isIntradayMinuteRange(key);
}

/**
 * Unix seconds window for candle APIs. `now` injectable for tests.
 * ALL caps at ~20y so vendors stay within free-tier limits.
 */
export function chartRangeWindow(
  key: ChartRangeKey,
  now = new Date(),
): { fromSec: number; toSec: number } {
  const toSec = Math.floor(now.getTime() / 1000);
  const def = chartRangeDef(key);

  if (def.lookbackMinutes != null) {
    return {
      fromSec: toSec - def.lookbackMinutes * 60,
      toSec,
    };
  }

  if (key === "YTD") {
    const start = Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0);
    return { fromSec: Math.floor(start / 1000), toSec };
  }

  if (key === "ALL" || def.lookbackDays == null) {
    const twentyY = 20 * 365.25 * 86_400;
    return { fromSec: Math.floor(toSec - twentyY), toSec };
  }

  return {
    fromSec: toSec - Math.ceil(def.lookbackDays * 86_400),
    toSec,
  };
}

/** Finnhub `/stock/candle` resolution for a desk range. */
export function finnhubResolutionForRange(key: ChartRangeKey): string {
  const interval = chartRangeDef(key).interval;
  switch (interval) {
    case "1":
      return "1";
    case "5":
      return "5";
    case "15":
      return "15";
    case "30":
      return "30";
    case "60":
      return "60";
    case "D":
      return "D";
    case "W":
      return "W";
    case "M":
      return "M";
    default:
      return "D";
  }
}

/** Polygon aggregates multiplier/timespan for a desk range. */
export function polygonAggForRange(key: ChartRangeKey): {
  multiplier: number;
  timespan: "minute" | "hour" | "day" | "week" | "month";
} {
  const interval = chartRangeDef(key).interval;
  switch (interval) {
    case "1":
      return { multiplier: 1, timespan: "minute" };
    case "5":
      return { multiplier: 5, timespan: "minute" };
    case "15":
      return { multiplier: 15, timespan: "minute" };
    case "30":
      return { multiplier: 30, timespan: "minute" };
    case "60":
      return { multiplier: 1, timespan: "hour" };
    case "D":
      return { multiplier: 1, timespan: "day" };
    case "W":
      return { multiplier: 1, timespan: "week" };
    case "M":
      return { multiplier: 1, timespan: "month" };
    default:
      return { multiplier: 1, timespan: "day" };
  }
}

export function ymdUtc(sec: number): string {
  return new Date(sec * 1000).toISOString().slice(0, 10);
}
