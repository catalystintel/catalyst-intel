import { describe, expect, it } from "vitest";

import {
  EARLY_ACCESS,
  FEEDBACK_CATEGORIES,
  isFeedbackCategory,
} from "@/lib/early-access";

describe("early-access copy", () => {
  it("names the free launch window Open Early Access", () => {
    expect(EARLY_ACCESS.label).toBe("Open Early Access");
    expect(EARLY_ACCESS.headline.toLowerCase()).toContain("free");
  });

  it("accepts only known feedback categories", () => {
    expect(FEEDBACK_CATEGORIES.map((c) => c.value)).toEqual([
      "bug",
      "feature",
      "improvement",
    ]);
    expect(isFeedbackCategory("bug")).toBe(true);
    expect(isFeedbackCategory("spam")).toBe(false);
  });
});
