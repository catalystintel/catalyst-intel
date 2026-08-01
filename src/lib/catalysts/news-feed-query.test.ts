import { describe, expect, it } from "vitest";

import {
  NEWS_FEED_TYPES,
  newsFeedIdentitySql,
  parseNewsFeedFilters,
  toNewsHeadline,
} from "./news-feed-query";

describe("news-feed-query", () => {
  it("recognizes news type labels including press releases", () => {
    expect(NEWS_FEED_TYPES).toEqual([
      "Company News",
      "Wire",
      "Press Release",
      "Market News",
    ]);
  });

  it("builds a non-null identity SQL fragment", () => {
    expect(newsFeedIdentitySql()).toBeTruthy();
  });

  it("parses filters with defaults", () => {
    const filters = parseNewsFeedFilters(
      new URLSearchParams(),
      1_700_000_000_000,
    );
    expect(filters.timeWindow).toBe("all");
    expect(filters.q).toBe("");
    expect(filters.categories).toEqual([]);
    expect(filters.symbols).toEqual([]);
    expect(filters.sources).toEqual([]);
    expect(filters.since).toBeNull();
  });

  it("parses window, q, categories, and symbols", () => {
    const filters = parseNewsFeedFilters(
      new URLSearchParams({
        window: "4h",
        q: "aapl",
        categories: "earnings,regulatory,bogus",
        symbols: "AAPL, msft ,",
      }),
      1_700_000_000_000,
    );
    expect(filters.timeWindow).toBe("4h");
    expect(filters.q).toBe("AAPL");
    expect(filters.categories).toEqual(["earnings", "regulatory"]);
    expect(filters.symbols).toEqual(["AAPL", "MSFT"]);
    expect(filters.since).toBeTruthy();
  });

  it("normalizes sentiment and category on headlines", () => {
    const row = toNewsHeadline({
      id: 1,
      symbol: "AAPL",
      companyName: "Apple",
      type: "Press Release",
      title: "Apple beats estimates",
      headline: "Benzinga Wire",
      eventCategory: "earnings",
      subcategory: "benzinga_wire",
      timestamp: "2026-07-25T12:00:00.000Z",
      summary: "Beat",
      impactScore: 70,
      sentiment: "bullish",
      sourceUrl: "https://example.com",
      sourceProvider: "polygon",
      externalId: "polygon:news:1",
    });
    expect(row.eventCategory).toBe("earnings");
    expect(row.sentiment).toBe("bullish");
    expect(row.symbol).toBe("AAPL");
    expect(row.headline).toBeNull();
    expect(row.subcategory).toBe("press_release");
    // Production payloads omit vendor origin fields.
    expect(row.sourceProvider).toBeNull();
    expect(row.sourceUrl).toBeNull();
    expect(row.externalId).toBeNull();

    const bad = toNewsHeadline({
      ...row,
      eventCategory: "not-a-category",
      sentiment: "mixed",
      sourceProvider: "polygon",
      sourceUrl: "https://example.com",
      externalId: "polygon:news:1",
    });
    expect(bad.eventCategory).toBeNull();
    expect(bad.sentiment).toBeNull();
  });
});
