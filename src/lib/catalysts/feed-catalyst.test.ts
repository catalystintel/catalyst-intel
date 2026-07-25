import { describe, expect, it } from "vitest";

import { compareFeedNewestFirst, sortFeedNewestFirst } from "./feed-catalyst";

describe("sortFeedNewestFirst", () => {
  it("orders by event timestamp descending", () => {
    const rows = [
      { id: 1, timestamp: "2026-07-25T10:00:00.000Z" },
      { id: 2, timestamp: "2026-07-25T12:00:00.000Z" },
      { id: 3, timestamp: "2026-07-25T11:00:00.000Z" },
    ];
    expect(sortFeedNewestFirst(rows).map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it("tie-breaks equal timestamps by higher id", () => {
    const rows = [
      { id: 10, timestamp: "2026-07-25T12:00:00.000Z" },
      { id: 30, timestamp: "2026-07-25T12:00:00.000Z" },
      { id: 20, timestamp: "2026-07-25T12:00:00.000Z" },
    ];
    expect(sortFeedNewestFirst(rows).map((r) => r.id)).toEqual([30, 20, 10]);
  });

  it("compareFeedNewestFirst matches sort order", () => {
    const a = { id: 1, timestamp: "2026-07-25T10:00:00.000Z" };
    const b = { id: 2, timestamp: "2026-07-25T11:00:00.000Z" };
    expect(compareFeedNewestFirst(a, b)).toBeGreaterThan(0);
    expect(compareFeedNewestFirst(b, a)).toBeLessThan(0);
  });
});
