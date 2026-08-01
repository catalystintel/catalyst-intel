import { describe, expect, it } from "vitest";

import {
  buildDemoCandles,
  clipCandlesToWindow,
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
