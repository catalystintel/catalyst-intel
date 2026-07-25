import { describe, expect, it } from "vitest";

import {
  isSymbollessMacroException,
  passesSymbolFeedGate,
} from "./symbol-feed-gate";

describe("isSymbollessMacroException", () => {
  it("allows macro-calendar CPI and NFP by subcategory", () => {
    expect(
      isSymbollessMacroException({
        symbol: null,
        eventCategory: "macro",
        subcategory: "cpi",
        title: "CPI — July 2026",
        tags: ["macro", "economics", "cpi", "keyless"],
      }),
    ).toBe(true);
    expect(
      isSymbollessMacroException({
        symbol: null,
        eventCategory: "macro",
        subcategory: "nfp",
        title: "NFP / Employment Situation — July 2026",
        tags: ["macro", "economics", "nfp", "keyless"],
      }),
    ).toBe(true);
  });

  it("rejects FOMC and other symbolless rows", () => {
    expect(
      isSymbollessMacroException({
        symbol: null,
        eventCategory: "macro",
        subcategory: "fomc",
        title: "FOMC rate decision",
        tags: ["macro", "economics", "fomc", "keyless"],
      }),
    ).toBe(false);
    expect(
      isSymbollessMacroException({
        symbol: null,
        eventCategory: "news",
        subcategory: null,
        title: "Market wrap",
        tags: [],
      }),
    ).toBe(false);
  });

  it("allows CPI / Jobs phrasing via title or tags", () => {
    expect(
      isSymbollessMacroException({
        symbol: null,
        title: "US CPI hotter than expected",
        tags: ["macro"],
      }),
    ).toBe(true);
    expect(
      isSymbollessMacroException({
        symbol: null,
        title: "Jobs report misses estimates",
        tags: [],
      }),
    ).toBe(true);
    expect(
      isSymbollessMacroException({
        symbol: null,
        title: "Labor update",
        tags: ["nfp"],
      }),
    ).toBe(true);
  });
});

describe("passesSymbolFeedGate", () => {
  it("keeps symbols for earnings / FDA / halts", () => {
    expect(
      passesSymbolFeedGate({
        symbol: "NVDA",
        eventCategory: "earnings",
        title: "Item 2.02",
      }),
    ).toBe(true);
    expect(
      passesSymbolFeedGate({
        symbol: "MRK",
        eventCategory: "regulatory",
        subcategory: "fda",
        title: "FDA decision",
      }),
    ).toBe(true);
    expect(
      passesSymbolFeedGate({
        symbol: "GME",
        eventCategory: "trading_halt",
        subcategory: "halt",
        title: "Trading halt",
      }),
    ).toBe(true);
  });

  it("drops blank symbol unless CPI/Jobs exception", () => {
    expect(
      passesSymbolFeedGate({
        symbol: "  ",
        title: "Untitled",
      }),
    ).toBe(false);
    expect(
      passesSymbolFeedGate({
        symbol: null,
        subcategory: "cpi",
        title: "CPI — July 2026",
      }),
    ).toBe(true);
  });
});
