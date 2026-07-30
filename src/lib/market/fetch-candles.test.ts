import { describe, expect, it } from "vitest";

import { buildDemoCandles } from "@/lib/market/fetch-candles";

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
});
