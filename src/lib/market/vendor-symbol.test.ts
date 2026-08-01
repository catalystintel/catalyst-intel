import { describe, expect, it } from "vitest";

import {
  stripExchangePrefix,
  toVendorBareSymbol,
  toYahooSymbol,
} from "./vendor-symbol";

describe("stripExchangePrefix", () => {
  it("strips TradingView exchange prefixes", () => {
    expect(stripExchangePrefix("NASDAQ:SKK")).toBe("SKK");
    expect(stripExchangePrefix("NYSE:BRK.B")).toBe("BRK.B");
    expect(stripExchangePrefix("TSX:BNS")).toBe("BNS");
  });

  it("leaves bare tickers alone", () => {
    expect(stripExchangePrefix("AAPL")).toBe("AAPL");
    expect(stripExchangePrefix("bf.a")).toBe("BF.A");
  });
});

describe("toYahooSymbol", () => {
  it("maps US share-class dots to hyphens", () => {
    expect(toYahooSymbol("BRK.B")).toBe("BRK-B");
    expect(toYahooSymbol("NYSE:BRK.B")).toBe("BRK-B");
  });

  it("keeps dual-listed market suffixes dotted", () => {
    expect(toYahooSymbol("BNS.TO")).toBe("BNS.TO");
  });

  it("strips exchange before mapping", () => {
    expect(toYahooSymbol("NASDAQ:SKK")).toBe("SKK");
  });
});

describe("toVendorBareSymbol", () => {
  it("is an alias for strip for Finnhub/Polygon", () => {
    expect(toVendorBareSymbol("NASDAQ:AAPL")).toBe("AAPL");
  });
});
