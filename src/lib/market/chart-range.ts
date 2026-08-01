/**
 * Desk-owned chart lookback windows. TradingView's free widgetembed does not
 * expose range-change events, so we drive interval + performance % ourselves.
 */

export const CHART_RANGE_KEYS = [
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
export type TradingViewInterval = "5" | "15" | "60" | "D" | "W" | "M";

export type ChartRangeDef = {
  key: ChartRangeKey;
  label: string;
  /** Widget candle size for the selected lookback. */
  interval: TradingViewInterval;
  /**
   * Approximate calendar days for candle fetch. `null` = unbounded / long
   * history (capped server-side). YTD is computed from Jan 1.
   */
  lookbackDays: number | null;
};

export const CHART_RANGES: readonly ChartRangeDef[] = [
  // 5 calendar days so weekends/holidays still cover the last US cash session
  // for Finnhub/Polygon 5-minute bars (Yahoo uses its own range param).
  { key: "1D", label: "1D", interval: "5", lookbackDays: 5 },
  { key: "5D", label: "5D", interval: "60", lookbackDays: 5 },
  { key: "1M", label: "1M", interval: "D", lookbackDays: 31 },
  { key: "3M", label: "3M", interval: "D", lookbackDays: 93 },
  { key: "6M", label: "6M", interval: "D", lookbackDays: 186 },
  { key: "YTD", label: "YTD", interval: "D", lookbackDays: null },
  { key: "1Y", label: "1Y", interval: "W", lookbackDays: 365 },
  { key: "5Y", label: "5Y", interval: "W", lookbackDays: 365 * 5 },
  { key: "ALL", label: "All", interval: "M", lookbackDays: null },
] as const;

export function isChartRangeKey(raw: string): raw is ChartRangeKey {
  return (CHART_RANGES as readonly ChartRangeDef[]).some((r) => r.key === raw);
}

export function chartRangeDef(key: ChartRangeKey): ChartRangeDef {
  return CHART_RANGES.find((r) => r.key === key) ?? CHART_RANGES[0]!;
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
    case "5":
      return "5";
    case "15":
      return "15";
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
    case "5":
      return { multiplier: 5, timespan: "minute" };
    case "15":
      return { multiplier: 15, timespan: "minute" };
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
