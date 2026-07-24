import { describe, expect, it } from "vitest";

import {
  GICS_SECTOR_LABELS,
  normalizeToGics,
  normalizeToGicsLabel,
} from "./gics-sectors";

describe("normalizeToGics", () => {
  it("maps Finnhub Technology to Information Technology", () => {
    expect(normalizeToGics("Technology")).toBe("information_technology");
    expect(normalizeToGicsLabel("Technology")).toBe(
      GICS_SECTOR_LABELS.information_technology,
    );
  });

  it("maps Health Care variants", () => {
    expect(normalizeToGics("Health Care")).toBe("health_care");
    expect(normalizeToGics("healthcare")).toBe("health_care");
  });

  it("maps Banking / Finance to Financials", () => {
    expect(normalizeToGics("Banking")).toBe("financials");
    expect(normalizeToGics("Finance")).toBe("financials");
  });

  it("accepts canonical labels and keys", () => {
    expect(normalizeToGics("Information Technology")).toBe(
      "information_technology",
    );
    expect(normalizeToGics("financials")).toBe("financials");
  });

  it("returns null for empty / N/A / unknown", () => {
    expect(normalizeToGics(null)).toBeNull();
    expect(normalizeToGics("")).toBeNull();
    expect(normalizeToGics("N/A")).toBeNull();
    expect(normalizeToGics("Totally Made Up Industry XYZ")).toBeNull();
  });
});
