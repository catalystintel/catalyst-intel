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
    expect(parsed.searchParams.get("interval")).toBe("5");
    expect(parsed.searchParams.get("withdateranges")).toBe("0");
    expect(parsed.searchParams.get("timezone")).toBe("America/New_York");
    expect(parsed.searchParams.get("style")).toBe("2");
  });

  it("maps desk ranges to TradingView intervals", () => {
    expect(
      new URL(
        buildTradingViewEmbedUrl("AAPL", { range: "1M" }),
      ).searchParams.get("interval"),
    ).toBe("D");
    expect(
      new URL(
        buildTradingViewEmbedUrl("AAPL", { range: "5Y" }),
      ).searchParams.get("interval"),
    ).toBe("W");
    expect(
      new URL(
        buildTradingViewEmbedUrl("AAPL", { range: "30m" }),
      ).searchParams.get("interval"),
    ).toBe("1");
    expect(
      new URL(
        buildTradingViewEmbedUrl("AAPL", { range: "1H" }),
      ).searchParams.get("interval"),
    ).toBe("1");
  });

  it("trims bare symbols", () => {
    const url = buildTradingViewEmbedUrl("  LBTYK  ");
    expect(new URL(url).searchParams.get("symbol")).toBe("LBTYK");
  });

  it("shows side toolbar in fullscreen mode", () => {
    const compact = new URL(buildTradingViewEmbedUrl("AAPL"));
    const full = new URL(
      buildTradingViewEmbedUrl("AAPL", { fullscreen: true }),
    );
    expect(compact.searchParams.get("hidesidetoolbar")).toBe("1");
    expect(full.searchParams.get("hidesidetoolbar")).toBe("0");
  });
});
