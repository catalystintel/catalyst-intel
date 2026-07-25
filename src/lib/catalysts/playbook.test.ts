import { describe, expect, it } from "vitest";

import {
  DEFAULT_PLAYBOOK_CATEGORIES,
  matchesQuietPlaybook,
  normalizePlaybookCategories,
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

describe("matchesQuietPlaybook", () => {
  const row = { symbol: "NVDA", eventCategory: "earnings" as const };

  it("passes everything when quiet mode is off", () => {
    expect(
      matchesQuietPlaybook(row, {
        quietMode: false,
        watchlistSymbols: ["AAPL"],
        playbookCategories: ["distress"],
      }),
    ).toBe(true);
  });

  it("requires watchlist symbol when watchlist is non-empty", () => {
    expect(
      matchesQuietPlaybook(row, {
        quietMode: true,
        watchlistSymbols: ["AAPL"],
        playbookCategories: DEFAULT_PLAYBOOK_CATEGORIES,
      }),
    ).toBe(false);
    expect(
      matchesQuietPlaybook(row, {
        quietMode: true,
        watchlistSymbols: ["nvda"],
        playbookCategories: DEFAULT_PLAYBOOK_CATEGORIES,
      }),
    ).toBe(true);
  });

  it("requires playbook category when categories are set", () => {
    expect(
      matchesQuietPlaybook(row, {
        quietMode: true,
        watchlistSymbols: [],
        playbookCategories: ["distress"],
      }),
    ).toBe(false);
    expect(
      matchesQuietPlaybook(row, {
        quietMode: true,
        watchlistSymbols: [],
        playbookCategories: ["earnings"],
      }),
    ).toBe(true);
  });
});
