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
  });

  it("prefers upgrade / downgrade / price target analyst subcategories", () => {
    expect(
      categorizeNewsHeadline("Analyst upgrades NVDA, raises PT"),
    ).toMatchObject({
      eventCategory: "analyst",
      subcategory: "upgrade",
    });
    expect(
      categorizeNewsHeadline("Street downgrades TSLA on demand concerns"),
    ).toMatchObject({
      eventCategory: "analyst",
      subcategory: "downgrade",
    });
    expect(
      categorizeNewsHeadline("Goldman raises PT to $300 on AAPL"),
    ).toMatchObject({
      eventCategory: "analyst",
      subcategory: "price_target",
    });
  });

  it("maps IPO language to capital / ipo_news", () => {
    expect(
      categorizeNewsHeadline("Widget Corp files for IPO on Nasdaq"),
    ).toMatchObject({
      eventCategory: "capital",
      subcategory: "ipo_news",
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
