import { describe, expect, it } from "vitest";

import { deriveAutoTags } from "./ingest-pipeline";

describe("deriveAutoTags", () => {
  it("derives namespaced tags from structured fields", () => {
    const tags = deriveAutoTags({
      eventCategory: "regulatory",
      type: "8-K",
      symbol: "abcd",
      session: "AH",
      impactScore: 85,
      sentiment: "bullish",
    });
    expect(tags).toEqual([
      "category:regulatory",
      "form:8-k",
      "session:AH",
      "impact:high",
      "sentiment:bullish",
      "symbol:abcd",
    ]);
  });

  it("omits session/sentiment/symbol tags when not applicable", () => {
    const tags = deriveAutoTags({
      eventCategory: "news",
      type: "8-K",
      symbol: null,
      session: "any",
      impactScore: 20,
    });
    expect(tags).toEqual(["category:news", "form:8-k", "impact:low"]);
  });

  it("buckets impact score into tiers", () => {
    const base = {
      eventCategory: "other" as const,
      type: "other",
      session: "RTH" as const,
    };
    expect(deriveAutoTags({ ...base, impactScore: 39 })).toContain(
      "impact:low",
    );
    expect(deriveAutoTags({ ...base, impactScore: 40 })).toContain(
      "impact:medium",
    );
    expect(deriveAutoTags({ ...base, impactScore: 70 })).toContain(
      "impact:high",
    );
  });
});
