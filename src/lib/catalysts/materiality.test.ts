import { describe, expect, it } from "vitest";

import { computeMateriality, scoreFromCategory } from "./materiality";

describe("computeMateriality", () => {
  it("starts from category base score", () => {
    const result = computeMateriality({ eventCategory: "earnings" });
    expect(result.score).toBe(scoreFromCategory("earnings"));
    expect(result.reasons[0]).toMatch(/Earnings/);
  });

  it("adds item weight for restatement (4.02)", () => {
    const result = computeMateriality({
      eventCategory: "distress",
      itemCodes: [{ code: "4.02" }],
    });
    expect(result.score).toBe(scoreFromCategory("distress") + 10);
    expect(result.reasons.some((r) => /High-weight/i.test(r))).toBe(true);
  });

  it("boosts microcaps and AH/PM sessions", () => {
    const result = computeMateriality({
      eventCategory: "capital",
      marketCapMillions: 120,
      session: "AH",
    });
    expect(result.score).toBe(scoreFromCategory("capital") + 6 + 8);
  });

  it("clamps to 0–100", () => {
    const result = computeMateriality({
      eventCategory: "distress",
      itemCodes: [{ code: "4.02" }],
      marketCapMillions: 50,
      session: "PM",
      sentiment: "bearish",
      sessionDeltaPct: -12,
    });
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
