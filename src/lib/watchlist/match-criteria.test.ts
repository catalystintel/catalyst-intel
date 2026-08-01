import { describe, expect, it } from "vitest";

import { matchesWatchlistCriteria } from "./match-criteria";

const base = {
  symbol: "NVDA",
  eventCategory: "earnings",
  type: "8-K",
  tags: ["category:earnings", "impact:high"],
  sourceProvider: "sec-edgar",
  companyName: "NVIDIA Corp",
  title: "NVIDIA reports Q3 results",
  headline: "Earnings beat",
};

describe("matchesWatchlistCriteria", () => {
  it("matches an empty criteria unconditionally", () => {
    expect(matchesWatchlistCriteria(base, {})).toBe(true);
  });

  it("ANDs across axes", () => {
    expect(
      matchesWatchlistCriteria(base, {
        categories: ["earnings"],
        tags: ["impact:high"],
      }),
    ).toBe(true);
    expect(
      matchesWatchlistCriteria(base, {
        categories: ["earnings"],
        tags: ["impact:low"],
      }),
    ).toBe(false);
  });

  it("any-matches within the tags axis", () => {
    expect(
      matchesWatchlistCriteria(base, { tags: ["impact:low", "impact:high"] }),
    ).toBe(true);
  });

  it("matches exact symbols case-insensitively", () => {
    expect(matchesWatchlistCriteria(base, { symbols: ["NVDA"] })).toBe(true);
    expect(matchesWatchlistCriteria(base, { symbols: ["AAPL"] })).toBe(false);
  });

  it("matches forms via the type -> form bucket mapping", () => {
    expect(matchesWatchlistCriteria(base, { forms: ["8-K"] })).toBe(true);
    expect(matchesWatchlistCriteria(base, { forms: ["424B"] })).toBe(false);
  });

  it("matches sources case-insensitively", () => {
    expect(matchesWatchlistCriteria(base, { sources: ["sec-edgar"] })).toBe(
      true,
    );
    expect(matchesWatchlistCriteria(base, { sources: ["polygon"] })).toBe(
      false,
    );
  });

  it("matches free-text q over symbol/company/title/headline", () => {
    expect(matchesWatchlistCriteria(base, { q: "nvidia" })).toBe(true);
    expect(matchesWatchlistCriteria(base, { q: "tesla" })).toBe(false);
  });

  it("fails closed when the row is missing a value the criteria needs", () => {
    expect(
      matchesWatchlistCriteria(
        { ...base, eventCategory: null },
        { categories: ["earnings"] },
      ),
    ).toBe(false);
    expect(
      matchesWatchlistCriteria(
        { ...base, symbol: null },
        { symbols: ["NVDA"] },
      ),
    ).toBe(false);
  });
});
