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

  it("resolves a dual-listed vendor-suffixed ticker via the exchange string", () => {
    // Finnhub's /stock/profile2?symbol=BNS quirk: canonicalizes to the
    // Toronto listing and returns ticker "BNS.TO" / exchange "TORONTO STOCK
    // EXCHANGE" even though BNS itself queried a clean symbol. TradingView
    // has no "BNS.TO" symbol — it needs "TSX:BNS".
    expect(toTradingViewSymbol("BNS.TO", "TORONTO STOCK EXCHANGE")).toBe(
      "TSX:BNS",
    );
  });

  it("falls back to the vendor suffix's own market code without exchange data", () => {
    expect(toTradingViewSymbol("BNS.TO", null)).toBe("TSX:BNS");
    expect(toTradingViewSymbol("shel.pa", undefined)).toBe("EURONEXT:SHEL");
  });

  it("never mangles a real single-letter share-class ticker", () => {
    // "BRK.B" / "BF.A" are legitimate US tickers, not vendor suffixes —
    // the dot must survive untouched.
    expect(toTradingViewSymbol("BRK.B", "NEW YORK STOCK EXCHANGE, INC.")).toBe(
      "NYSE:BRK.B",
    );
    expect(toTradingViewSymbol("BF.A", null)).toBe("BF.A");
  });

  it("maps TSX Venture and London exchange strings", () => {
    expect(toTradingViewSymbol("ABC", "TSX VENTURE EXCHANGE")).toBe("TSXV:ABC");
    expect(toTradingViewSymbol("SHEL", "LONDON STOCK EXCHANGE")).toBe(
      "LSE:SHEL",
    );
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
