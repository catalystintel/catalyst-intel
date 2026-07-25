import { describe, expect, it } from "vitest";

import {
  isTickerlessMacroException,
  passesTickerFeedGate,
} from "./ticker-feed-gate";

describe("isTickerlessMacroException", () => {
  it("allows macro-calendar CPI and NFP by subcategory", () => {
    expect(
      isTickerlessMacroException({
        ticker: null,
        eventCategory: "macro",
        subcategory: "cpi",
        title: "CPI — July 2026",
        tags: ["macro", "economics", "cpi", "keyless"],
      }),
    ).toBe(true);
    expect(
      isTickerlessMacroException({
        ticker: null,
        eventCategory: "macro",
        subcategory: "nfp",
        title: "NFP / Employment Situation — July 2026",
        tags: ["macro", "economics", "nfp", "keyless"],
      }),
    ).toBe(true);
  });

  it("rejects FOMC and other tickerless rows", () => {
    expect(
      isTickerlessMacroException({
        ticker: null,
        eventCategory: "macro",
        subcategory: "fomc",
        title: "FOMC rate decision",
        tags: ["macro", "economics", "fomc", "keyless"],
      }),
    ).toBe(false);
    expect(
      isTickerlessMacroException({
        ticker: null,
        eventCategory: "news",
        subcategory: null,
        title: "Market wrap",
        tags: [],
      }),
    ).toBe(false);
  });

  it("allows CPI / Jobs phrasing via title or tags", () => {
    expect(
      isTickerlessMacroException({
        ticker: null,
        title: "US CPI hotter than expected",
        tags: ["macro"],
      }),
    ).toBe(true);
    expect(
      isTickerlessMacroException({
        ticker: null,
        title: "Jobs report misses estimates",
        tags: [],
      }),
    ).toBe(true);
    expect(
      isTickerlessMacroException({
        ticker: null,
        title: "Labor update",
        tags: ["nfp"],
      }),
    ).toBe(true);
  });
});

describe("passesTickerFeedGate", () => {
  it("keeps tickers for earnings / FDA / halts", () => {
    expect(
      passesTickerFeedGate({
        ticker: "NVDA",
        eventCategory: "earnings",
        title: "Item 2.02",
      }),
    ).toBe(true);
    expect(
      passesTickerFeedGate({
        ticker: "MRK",
        eventCategory: "regulatory",
        subcategory: "fda",
        title: "FDA decision",
      }),
    ).toBe(true);
    expect(
      passesTickerFeedGate({
        ticker: "GME",
        eventCategory: "trading_halt",
        subcategory: "halt",
        title: "Trading halt",
      }),
    ).toBe(true);
  });

  it("drops blank ticker unless CPI/Jobs exception", () => {
    expect(
      passesTickerFeedGate({
        ticker: "  ",
        title: "Untitled",
      }),
    ).toBe(false);
    expect(
      passesTickerFeedGate({
        ticker: null,
        subcategory: "cpi",
        title: "CPI — July 2026",
      }),
    ).toBe(true);
  });
});
