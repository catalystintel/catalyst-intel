import { describe, expect, it } from "vitest";

import {
  formatMarketCapMillions,
  toTradingViewSymbol,
} from "./enrich-article-format";

describe("toTradingViewSymbol", () => {
  it("maps common US exchanges", () => {
    expect(toTradingViewSymbol("AAPL", "NASDAQ NMS")).toBe("NASDAQ:AAPL");
    expect(toTradingViewSymbol("IBM", "NEW YORK STOCK EXCHANGE, INC.")).toBe(
      "NYSE:IBM",
    );
    expect(toTradingViewSymbol("SPY", "NYSE ARCA")).toBe("AMEX:SPY");
  });

  it("uppercases bare tickers when exchange is unknown", () => {
    expect(toTradingViewSymbol("xyz", null)).toBe("XYZ");
  });
});

describe("formatMarketCapMillions", () => {
  it("formats M/B/T thresholds", () => {
    expect(formatMarketCapMillions(850)).toBe("$850.0M");
    expect(formatMarketCapMillions(2_450)).toBe("$2.45B");
    expect(formatMarketCapMillions(1_200_000)).toBe("$1.20T");
    expect(formatMarketCapMillions(null)).toBeNull();
    expect(formatMarketCapMillions(0)).toBeNull();
  });
});
