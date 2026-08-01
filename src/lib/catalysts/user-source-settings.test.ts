import { describe, expect, it } from "vitest";

import { normalizeShowSourceLabels } from "@/lib/catalysts/user-source-settings";

describe("user-source-settings", () => {
  it("normalizes showSourceLabels from JSON-ish values", () => {
    expect(normalizeShowSourceLabels(true)).toBe(true);
    expect(normalizeShowSourceLabels(1)).toBe(true);
    expect(normalizeShowSourceLabels("true")).toBe(true);
    expect(normalizeShowSourceLabels("1")).toBe(true);
    expect(normalizeShowSourceLabels(false)).toBe(false);
    expect(normalizeShowSourceLabels(0)).toBe(false);
    expect(normalizeShowSourceLabels(null)).toBe(false);
    expect(normalizeShowSourceLabels(undefined)).toBe(false);
    expect(normalizeShowSourceLabels("no")).toBe(false);
  });
});
