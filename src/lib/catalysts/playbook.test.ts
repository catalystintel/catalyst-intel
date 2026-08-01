import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLAYBOOK_CATEGORIES,
  matchesQuietPlaybook,
  normalizePlaybookCategories,
  normalizeWatchlistIds,
} from "./playbook";

describe("normalizePlaybookCategories", () => {
  it("keeps valid unique categories", () => {
    expect(
      normalizePlaybookCategories(["earnings", "bogus", "earnings", "deals"]),
    ).toEqual(["earnings", "deals"]);
  });

  it("returns empty for non-arrays", () => {
    expect(normalizePlaybookCategories(null)).toEqual([]);
  });
});

describe("normalizeWatchlistIds", () => {
  it("dedupes, coerces, and drops invalid ids", () => {
    expect(normalizeWatchlistIds([1, "2", 2, 0, -1, "nope", 3.5])).toEqual([
      1, 2,
    ]);
  });

  it("returns empty for non-arrays", () => {
    expect(normalizeWatchlistIds(null)).toEqual([]);
  });

  it("caps at max", () => {
    expect(normalizeWatchlistIds([1, 2, 3, 4], 2)).toEqual([1, 2]);
  });
});

describe("matchesQuietPlaybook", () => {
  const row = {
    symbol: "NVDA",
    eventCategory: "earnings" as const,
    type: "8-K",
    tags: ["category:earnings", "impact:high"],
    sourceProvider: "sec-edgar",
  };

  it("passes everything when quiet mode is off", () => {
    expect(
      matchesQuietPlaybook(row, {
        quietMode: false,
        watchlistSymbols: ["AAPL"],
        signalWatchlists: [{ id: 1, criteria: { categories: ["distress"] } }],
      }),
    ).toBe(true);
  });

  it("matches the flat symbol list as a signal source", () => {
    expect(
      matchesQuietPlaybook(row, {
        quietMode: true,
        watchlistSymbols: ["AAPL"],
        signalWatchlists: [],
      }),
    ).toBe(false);
    expect(
      matchesQuietPlaybook(row, {
        quietMode: true,
        watchlistSymbols: ["nvda"],
        signalWatchlists: [],
      }),
    ).toBe(true);
  });

  it("matches ANY selected watchlist's criteria (not ANDed across watchlists)", () => {
    expect(
      matchesQuietPlaybook(row, {
        quietMode: true,
        watchlistSymbols: [],
        signalWatchlists: [
          { id: 1, criteria: { categories: ["distress"] } },
          { id: 2, criteria: { categories: ["earnings"] } },
        ],
      }),
    ).toBe(true);
    expect(
      matchesQuietPlaybook(row, {
        quietMode: true,
        watchlistSymbols: [],
        signalWatchlists: [{ id: 1, criteria: { categories: ["distress"] } }],
      }),
    ).toBe(false);
  });

  it("combines flat symbols and watchlists as independent OR sources", () => {
    // Row's symbol isn't on the flat list, but it matches a selected watchlist's tag.
    expect(
      matchesQuietPlaybook(row, {
        quietMode: true,
        watchlistSymbols: ["AAPL"],
        signalWatchlists: [{ id: 1, criteria: { tags: ["impact:high"] } }],
      }),
    ).toBe(true);
  });

  it("falls back to DEFAULT_PLAYBOOK_CATEGORIES when nothing is configured", () => {
    expect(
      matchesQuietPlaybook(row, {
        quietMode: true,
        watchlistSymbols: [],
        signalWatchlists: [],
      }),
    ).toBe(DEFAULT_PLAYBOOK_CATEGORIES.includes("earnings"));
    expect(
      matchesQuietPlaybook(
        { ...row, eventCategory: "news" },
        { quietMode: true, watchlistSymbols: [], signalWatchlists: [] },
      ),
    ).toBe(false);
  });
});
