import { describe, expect, it } from "vitest";

import { materialityFromScore, scoreFromCategory } from "./materiality";

describe("scoreFromCategory", () => {
  it("maps known categories to priority scores", () => {
    expect(scoreFromCategory("distress")).toBe(90);
    expect(scoreFromCategory("earnings")).toBe(85);
    expect(scoreFromCategory("disclosure")).toBe(20);
  });

  it("falls back to other when missing", () => {
    expect(scoreFromCategory(null)).toBe(10);
    expect(scoreFromCategory(undefined)).toBe(10);
  });
});

describe("materialityFromScore", () => {
  it("tiers high / medium / low", () => {
    expect(materialityFromScore(90).tier).toBe("high");
    expect(materialityFromScore(55).tier).toBe("medium");
    expect(materialityFromScore(20).tier).toBe("low");
  });

  it("uses category fallback when score is null", () => {
    expect(materialityFromScore(null, "deals")).toMatchObject({
      score: 80,
      tier: "high",
      label: "High",
    });
  });
});
