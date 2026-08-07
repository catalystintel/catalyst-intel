import { describe, expect, it } from "vitest";

import { WATCHLIST_STARTER_PACK_IDS, watchlistTemplateById } from "./templates";

describe("watchlist starter pack", () => {
  it("resolves every starter id to a template", () => {
    for (const id of WATCHLIST_STARTER_PACK_IDS) {
      expect(watchlistTemplateById(id)?.id).toBe(id);
    }
  });
});
