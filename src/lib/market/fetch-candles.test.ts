import { describe, expect, it } from "vitest";

import {
  buildDemoCandles,
  clipCandlesToWindow,
  keepLastSessionCandles,
} from "@/lib/market/fetch-candles";

describe("buildDemoCandles", () => {
  it("returns ascending OHLC bars for 1D", () => {
    const bars = buildDemoCandles("1D", new Date("2026-07-30T15:00:00Z"));
    expect(bars.length).toBeGreaterThan(10);
    expect(bars[0]!.time).toBeLessThan(bars[bars.length - 1]!.time);
    for (const b of bars) {
      expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close));
      expect(b.low).toBeLessThanOrEqual(Math.min(b.open, b.close));
    }
  });

  it("builds 1-minute steps for short lookbacks", () => {
    const now = new Date("2026-08-01T15:00:00Z");
    const bars30 = buildDemoCandles("30m", now);
    expect(bars30.length).toBe(31);
    expect(bars30[1]!.time - bars30[0]!.time).toBe(60);

    const bars1 = buildDemoCandles("1m", now);
    expect(bars1.length).toBe(2);
  });
});

describe("clipCandlesToWindow", () => {
  it("keeps bars inside the lookback window", () => {
    const clipped = clipCandlesToWindow(
      [
        { time: 100, open: 1, high: 1, low: 1, close: 1 },
        { time: 200, open: 2, high: 2, low: 2, close: 2 },
        { time: 300, open: 3, high: 3, low: 3, close: 3 },
      ],
      150,
      250,
    );
    expect(clipped).toEqual([
      { time: 200, open: 2, high: 2, low: 2, close: 2 },
    ]);
  });
});

describe("keepLastSessionCandles", () => {
  it("keeps only the newest UTC day for 1D", () => {
    const day1 = Date.parse("2026-07-30T14:00:00Z") / 1000;
    const day2 = Date.parse("2026-07-31T14:00:00Z") / 1000;
    const bars = [
      { time: day1, open: 1, high: 2, low: 1, close: 1.5 },
      { time: day1 + 300, open: 1.5, high: 2, low: 1.4, close: 1.6 },
      { time: day2, open: 2, high: 3, low: 2, close: 2.5 },
      { time: day2 + 300, open: 2.5, high: 3, low: 2.4, close: 2.6 },
    ];
    const kept = keepLastSessionCandles(bars, "1D");
    expect(kept).toHaveLength(2);
    expect(kept[0]!.time).toBe(day2);
  });

  it("does not filter longer ranges", () => {
    const bars = [
      { time: 1, open: 1, high: 2, low: 1, close: 1.5 },
      { time: 100_000, open: 2, high: 3, low: 2, close: 2.5 },
    ];
    expect(keepLastSessionCandles(bars, "1M")).toEqual(bars);
  });
});
