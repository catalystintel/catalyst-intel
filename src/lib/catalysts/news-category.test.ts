import { describe, expect, it } from "vitest";

import { categorizeNewsHeadline } from "./news-category";

describe("categorizeNewsHeadline", () => {
  it("maps FDA / earnings / M&A / ratings into Benzinga-like panels", () => {
    expect(
      categorizeNewsHeadline("FDA approves new oncology drug"),
    ).toMatchObject({
      eventCategory: "regulatory",
      subcategory: "fda_news",
    });
    expect(
      categorizeNewsHeadline("ACME beats estimates on Q2 earnings"),
    ).toMatchObject({
      eventCategory: "earnings",
      subcategory: "earnings_news",
    });
    expect(
      categorizeNewsHeadline("Widget Corp to acquire Rival Inc"),
    ).toMatchObject({
      eventCategory: "deals",
      subcategory: "ma_news",
    });
    expect(
      categorizeNewsHeadline("Analyst upgrades NVDA, raises PT"),
    ).toMatchObject({
      eventCategory: "analyst",
      subcategory: "analyst_rating",
    });
  });

  it("falls back to company news", () => {
    expect(
      categorizeNewsHeadline("Company announces partnership"),
    ).toMatchObject({
      eventCategory: "news",
      subcategory: "company_news",
    });
  });
});
