import { describe, expect, it } from "vitest";

import {
  chartRangeWindow,
  finnhubResolutionForRange,
  isChartRangeKey,
  polygonAggForRange,
} from "./chart-range";
import { performanceFromCandles } from "./range-performance";

describe("chart-range", () => {
  it("validates range keys", () => {
    expect(isChartRangeKey("1M")).toBe(true);
    expect(isChartRangeKey("1m")).toBe(false);
    expect(isChartRangeKey("2Y")).toBe(false);
  });

  it("maps YTD to Jan 1 UTC of the current year", () => {
    const now = new Date("2026-07-25T15:00:00.000Z");
    const { fromSec, toSec } = chartRangeWindow("YTD", now);
    expect(new Date(fromSec * 1000).toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(toSec).toBe(Math.floor(now.getTime() / 1000));
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
