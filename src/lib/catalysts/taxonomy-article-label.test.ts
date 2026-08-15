import { describe, expect, it } from "vitest";

import {
  CATEGORY_LABELS,
  articleCategoryLabel,
  showArticleCategoryBadge,
} from "./taxonomy";

describe("articleCategoryLabel", () => {
  it("keeps Capital Markets in taxonomy but hides it from article chrome", () => {
    expect(CATEGORY_LABELS.capital).toBe("Capital Markets");
    expect(articleCategoryLabel("capital")).toBeNull();
    expect(showArticleCategoryBadge("capital")).toBe(false);
  });

  it("still shows other categories inside articles", () => {
    expect(articleCategoryLabel("earnings")).toBe("Earnings");
    expect(showArticleCategoryBadge("earnings")).toBe(true);
  });
});
