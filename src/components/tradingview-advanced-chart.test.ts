import { describe, expect, it } from "vitest";

import { buildTradingViewEmbedUrl } from "./tradingview-advanced-chart";

describe("buildTradingViewEmbedUrl", () => {
  it("embeds exchange-qualified symbols", () => {
    const url = buildTradingViewEmbedUrl("NASDAQ:AAPL");
    expect(url.startsWith("https://s.tradingview.com/widgetembed/?")).toBe(
      true,
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("symbol")).toBe("NASDAQ:AAPL");
    expect(parsed.searchParams.get("theme")).toBe("dark");
    expect(parsed.searchParams.get("interval")).toBe("D");
    expect(parsed.searchParams.get("timezone")).toBe("America/New_York");
  });

  it("trims bare tickers", () => {
    const url = buildTradingViewEmbedUrl("  LBTYK  ");
    expect(new URL(url).searchParams.get("symbol")).toBe("LBTYK");
  });
});
