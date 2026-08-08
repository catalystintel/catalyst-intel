import { describe, expect, it } from "vitest";

import { normalizeWatchlistCriteria } from "./normalize-criteria";

describe("normalizeWatchlistCriteria", () => {
  it("coerces and dedupes each axis", () => {
    const criteria = normalizeWatchlistCriteria({
      symbols: ["nvda", "NVDA", "aapl"],
      categories: ["earnings", "not-real", "clinical"],
      forms: ["8-K", "not-a-form", "4"],
      tags: ["FDA", "fda", "impact:HIGH"],
      sources: ["SEC-EDGAR"],
      q: "  guidance  ",
    });
    expect(criteria).toEqual({
      symbols: ["NVDA", "AAPL"],
      categories: ["earnings", "clinical"],
      forms: ["8-K", "4"],
      tags: ["fda", "impact:high"],
      sources: ["sec-edgar"],
      q: "guidance",
    });
  });

  it("returns an empty object for non-object input", () => {
    expect(normalizeWatchlistCriteria(null)).toEqual({});
    expect(normalizeWatchlistCriteria("nope")).toEqual({});
    expect(normalizeWatchlistCriteria(undefined)).toEqual({});
  });

  it("omits empty axes rather than including empty arrays", () => {
    const criteria = normalizeWatchlistCriteria({
      symbols: [],
      categories: ["not-real"],
    });
    expect(criteria).toEqual({});
  });

  it("caps free-form tag length", () => {
    const long = `fda:${"x".repeat(120)}`;
    const criteria = normalizeWatchlistCriteria({ tags: [long] });
    expect(criteria.tags?.[0]?.length).toBe(64);
  });
});
