import { describe, expect, it } from "vitest";

import { RETENTION_DAYS, computeRetentionCutoff } from "./data-retention";

describe("computeRetentionCutoff", () => {
  it("subtracts the default retention window from now", () => {
    const now = new Date("2026-07-19T12:00:00.000Z");
    const cutoff = computeRetentionCutoff(now);
    expect(cutoff).toBe("2026-06-19T12:00:00.000Z");
  });

  it("honors a custom retention window", () => {
    const now = new Date("2026-07-19T12:00:00.000Z");
    expect(computeRetentionCutoff(now, 7)).toBe("2026-07-12T12:00:00.000Z");
  });

  it("defaults to RETENTION_DAYS when no override is given", () => {
    const now = new Date("2026-07-19T00:00:00.000Z");
    const withDefault = computeRetentionCutoff(now);
    const withExplicitConstant = computeRetentionCutoff(now, RETENTION_DAYS);
    expect(withDefault).toBe(withExplicitConstant);
  });
});
