import { describe, expect, it } from "vitest";

import {
  CHART_RANGES,
  chartRangeDef,
  chartRangeWindow,
  finnhubResolutionForRange,
  isChartRangeKey,
  isIntradayMinuteRange,
  parseChartRangeKey,
  polygonAggForRange,
} from "./chart-range";
import { performanceFromCandles } from "./range-performance";

describe("chart-range", () => {
  it("validates range keys (1m minutes vs 1M month stay distinct)", () => {
    expect(isChartRangeKey("1M")).toBe(true);
    expect(isChartRangeKey("1m")).toBe(true);
    expect(isChartRangeKey("5m")).toBe(true);
    expect(isChartRangeKey("10m")).toBe(true);
    expect(isChartRangeKey("30m")).toBe(true);
    expect(isChartRangeKey("1H")).toBe(true);
    expect(isChartRangeKey("2Y")).toBe(false);
  });

  it("uses professional display labels without collapsing minute/month keys", () => {
    expect(chartRangeDef("1m").label).toBe("1 Min");
    expect(chartRangeDef("5m").label).toBe("5 Min");
    expect(chartRangeDef("10m").label).toBe("10 Min");
    expect(chartRangeDef("30m").label).toBe("30 Min");
    expect(chartRangeDef("1H").label).toBe("1H");
    expect(chartRangeDef("1M").label).toBe("1 Mo");
    expect(chartRangeDef("3M").label).toBe("3 Mo");
    expect(chartRangeDef("6M").label).toBe("6 Mo");
    // Chip labels must not equal ambiguous bare "1M" for both units.
    const labels = CHART_RANGES.map((r) => r.label);
    expect(labels.filter((l) => l === "1M")).toHaveLength(0);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("parses range params without collapsing 1m into 1M", () => {
    expect(parseChartRangeKey("1m")).toBe("1m");
    expect(parseChartRangeKey("1M")).toBe("1M");
    expect(parseChartRangeKey("1d")).toBe("1D");
    expect(parseChartRangeKey("30M")).toBe("30m");
    expect(parseChartRangeKey("1h")).toBe("1H");
    expect(parseChartRangeKey("nope")).toBeNull();
  });

  it("maps YTD to Jan 1 UTC of the current year", () => {
    const now = new Date("2026-07-25T15:00:00.000Z");
    const { fromSec, toSec } = chartRangeWindow("YTD", now);
    expect(new Date(fromSec * 1000).toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(toSec).toBe(Math.floor(now.getTime() / 1000));
  });

  it("maps short lookbacks to minute windows + 1m vendor resolution", () => {
    const now = new Date("2026-08-01T15:00:00.000Z");
    const toSec = Math.floor(now.getTime() / 1000);

    expect(isIntradayMinuteRange("30m")).toBe(true);
    expect(isIntradayMinuteRange("1D")).toBe(false);

    expect(chartRangeWindow("1m", now)).toEqual({
      fromSec: toSec - 60,
      toSec,
    });
    expect(chartRangeWindow("5m", now)).toEqual({
      fromSec: toSec - 5 * 60,
      toSec,
    });
    expect(chartRangeWindow("10m", now)).toEqual({
      fromSec: toSec - 10 * 60,
      toSec,
    });
    expect(chartRangeWindow("30m", now)).toEqual({
      fromSec: toSec - 30 * 60,
      toSec,
    });
    expect(chartRangeWindow("1H", now)).toEqual({
      fromSec: toSec - 60 * 60,
      toSec,
    });

    for (const key of ["1m", "5m", "10m", "30m", "1H"] as const) {
      expect(finnhubResolutionForRange(key)).toBe("1");
      expect(polygonAggForRange(key)).toEqual({
        multiplier: 1,
        timespan: "minute",
      });
    }
  });

  it("maps resolutions for Finnhub / Polygon", () => {
    expect(finnhubResolutionForRange("1D")).toBe("5");
    expect(finnhubResolutionForRange("1M")).toBe("D");
    expect(polygonAggForRange("5D")).toEqual({
      multiplier: 1,
      timespan: "hour",
    });
    expect(polygonAggForRange("ALL")).toEqual({
      multiplier: 1,
      timespan: "month",
    });
  });
});

describe("performanceFromCandles", () => {
  it("computes last close vs first open", () => {
    expect(
      performanceFromCandles({
        opens: [10, 11, 12],
        closes: [10.5, 11.2, 12.5],
      }),
    ).toEqual({
      price: 12.5,
      baseline: 10,
      change: 2.5,
      changePercent: 25,
    });
  });

  it("falls back to first close when opens missing", () => {
    expect(
      performanceFromCandles({
        opens: [],
        closes: [8, 10],
      }),
    ).toEqual({
      price: 10,
      baseline: 8,
      change: 2,
      changePercent: 25,
    });
  });

  it("returns nulls for empty series", () => {
    expect(performanceFromCandles({ opens: [], closes: [] })).toEqual({
      price: null,
      change: null,
      changePercent: null,
      baseline: null,
    });
  });
});
