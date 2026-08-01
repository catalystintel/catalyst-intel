import { describe, expect, it } from "vitest";

import { normalizeAlertConditions } from "./normalize";

describe("normalizeAlertConditions", () => {
  it("keeps watchlistIds as positive integers (deduped)", () => {
    expect(
      normalizeAlertConditions({
        watchlistIds: [1, "2", 2, 0, -1, "nope", 3.5, 4],
        sessions: ["AH"],
      }),
    ).toEqual({
      sessions: ["AH"],
      watchlistIds: [1, 2, 4],
    });
  });

  it("drops empty watchlistIds", () => {
    expect(normalizeAlertConditions({ watchlistIds: [] })).toEqual({});
  });

  it("preserves legacy watchlistOnly", () => {
    expect(normalizeAlertConditions({ watchlistOnly: true })).toEqual({
      watchlistOnly: true,
    });
  });
});
