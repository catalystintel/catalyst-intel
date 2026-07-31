import { describe, expect, it } from "vitest";

import {
  epsSurprisePctFrom,
  isMaterialEpsSurprise,
  MATERIAL_EPS_SURPRISE_PCT,
} from "./earnings-surprise";

describe("epsSurprisePctFrom", () => {
  it("prefers explicit surprise %", () => {
    expect(epsSurprisePctFrom(1, 1, 12.5)).toBe(12.5);
  });

  it("computes from actual vs estimate", () => {
    expect(epsSurprisePctFrom(1.1, 1.0)).toBeCloseTo(10, 5);
    expect(epsSurprisePctFrom(0.9, 1.0)).toBeCloseTo(-10, 5);
  });

  it("returns null without figures", () => {
    expect(epsSurprisePctFrom(null, 1)).toBeNull();
    expect(epsSurprisePctFrom(1, 0)).toBeNull();
  });
});

describe("isMaterialEpsSurprise", () => {
  it("uses the material threshold", () => {
    expect(MATERIAL_EPS_SURPRISE_PCT).toBe(5);
    expect(isMaterialEpsSurprise(5)).toBe(true);
    expect(isMaterialEpsSurprise(-5.1)).toBe(true);
    expect(isMaterialEpsSurprise(4.9)).toBe(false);
    expect(isMaterialEpsSurprise(null)).toBe(false);
  });
});
