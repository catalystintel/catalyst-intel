import { describe, expect, it } from "vitest";

import type { FeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import { mergeFeedRows } from "@/hooks/use-live-feed-query";

function row(id: number, timestamp: string, symbol = "AAPL"): FeedCatalyst {
  return {
    id,
    title: `Row ${id}`,
    symbol,
    timestamp,
    sourceProvider: "sec_edgar",
    eventCategory: "filing",
  } as FeedCatalyst;
}

describe("mergeFeedRows", () => {
  it("keeps already-loaded rows when a fresh first page arrives", () => {
    const prev = [
      row(3, "2026-08-08T12:00:00.000Z"),
      row(2, "2026-08-08T11:00:00.000Z"),
      row(1, "2026-08-08T10:00:00.000Z"),
    ];
    // Silent poll first page only has the newest two (+ a brand-new one).
    const page = [
      row(4, "2026-08-08T13:00:00.000Z"),
      row(3, "2026-08-08T12:00:00.000Z"),
      row(2, "2026-08-08T11:00:00.000Z"),
    ];

    const merged = mergeFeedRows(prev, page);
    expect(merged.map((c) => c.id)).toEqual([4, 3, 2, 1]);
  });

  it("updates overlapping rows in place", () => {
    const prev = [row(1, "2026-08-08T10:00:00.000Z")];
    const page = [
      {
        ...row(1, "2026-08-08T10:00:00.000Z"),
        title: "Updated title",
      },
    ];

    const merged = mergeFeedRows(prev, page);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.title).toBe("Updated title");
  });
});
