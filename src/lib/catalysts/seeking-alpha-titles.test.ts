import { describe, expect, it } from "vitest";

import {
  cleanSeekingAlphaHeadline,
  extractCompanyFromSeekingAlphaHeadline,
  formatSeekingAlphaTitle,
  isSeekingAlphaCatalyst,
  isSeekingAlphaSource,
} from "./seeking-alpha-titles";

describe("isSeekingAlphaSource", () => {
  it("matches spaced and compact publisher labels", () => {
    expect(isSeekingAlphaSource("Seeking Alpha")).toBe(true);
    expect(isSeekingAlphaSource("SeekingAlpha")).toBe(true);
    expect(isSeekingAlphaSource("seeking alpha")).toBe(true);
    expect(isSeekingAlphaSource("Reuters")).toBe(false);
  });
});

describe("isSeekingAlphaCatalyst", () => {
  it("detects publisher headline and seekingalpha.com URLs", () => {
    expect(isSeekingAlphaCatalyst({ headline: "SeekingAlpha" })).toBe(true);
    expect(
      isSeekingAlphaCatalyst({
        headline: "Company news",
        sourceUrl: "https://seekingalpha.com/article/123",
      }),
    ).toBe(true);
    expect(
      isSeekingAlphaCatalyst({
        headline: "Reuters",
        sourceUrl: "https://reuters.com/x",
      }),
    ).toBe(false);
  });
});

describe("cleanSeekingAlphaHeadline", () => {
  it("strips rating parentheticals and first-person openers", () => {
    expect(
      cleanSeekingAlphaHeadline(
        "I Was Wrong About Johnson & Johnson: Upgrading To Hold (Rating Upgrade)",
      ),
    ).toBe("Johnson & Johnson: Upgrading To Hold");
  });
});

describe("extractCompanyFromSeekingAlphaHeadline", () => {
  it("pulls company from About / Company: patterns", () => {
    expect(
      extractCompanyFromSeekingAlphaHeadline(
        "I Was Wrong About Johnson & Johnson: Upgrading To Hold (Rating Upgrade)",
      ),
    ).toBe("Johnson & Johnson");
    expect(
      extractCompanyFromSeekingAlphaHeadline(
        "Apple Stock: Services Growth Supports The Thesis",
      ),
    ).toBe("Apple");
  });
});

describe("formatSeekingAlphaTitle", () => {
  it("formats rating upgrades with company from the headline", () => {
    expect(
      formatSeekingAlphaTitle({
        title:
          "I Was Wrong About Johnson & Johnson: Upgrading To Hold (Rating Upgrade)",
        summary: "Upgrades JNJ from Sell to Hold after Q2.",
        companyName: "ABBV",
        symbol: "ABBV",
        eventCategory: "analyst",
        subcategory: "upgrade",
      }),
    ).toBe("Johnson & Johnson - Upgraded to Hold");
  });

  it("formats earnings week-ahead pieces without a wrong ticker prefix", () => {
    expect(
      formatSeekingAlphaTitle({
        title:
          "Big Tech Earnings, Fed's Interest Rate Decision To Keep Next Week Busy",
        summary: "Key earnings (AAPL, MSFT, META), Fed decision.",
        companyName: "ABBV",
        symbol: "ABBV",
        eventCategory: "earnings",
        subcategory: "earnings_news",
      }),
    ).toBe("Earnings Week Ahead");

    expect(
      formatSeekingAlphaTitle({
        title: "Banking Heavyweights To Kick Off Earnings Next Week",
        companyName: "JPM",
        symbol: "JPM",
        eventCategory: "earnings",
        subcategory: "earnings_news",
      }),
    ).toBe("Earnings Week Ahead");
  });

  it("prefixes company for single-name earnings / FDA / offering / thesis", () => {
    expect(
      formatSeekingAlphaTitle({
        title: "Apple Earnings Preview: What Traders Should Watch",
        companyName: "Apple Inc.",
        symbol: "AAPL",
        eventCategory: "earnings",
        subcategory: "earnings_news",
      }),
    ).toBe("Apple - Earnings Preview");

    expect(
      formatSeekingAlphaTitle({
        title: "Pfizer Faces Key FDA Adcom This Week",
        companyName: "Pfizer Inc",
        symbol: "PFE",
        eventCategory: "regulatory",
        subcategory: "fda_news",
      }),
    ).toBe("Pfizer Inc - FDA Catalyst");

    expect(
      formatSeekingAlphaTitle({
        title: "Acme Announces Secondary Offering",
        companyName: "Acme Corp",
        symbol: "ACME",
        eventCategory: "capital",
        subcategory: "offering_news",
      }),
    ).toBe("Acme Corp - Stock Offering");

    expect(
      formatSeekingAlphaTitle({
        title: "Why I'm Bullish On NVIDIA: The AI Capex Cycle",
        companyName: "NVIDIA Corp",
        symbol: "NVDA",
        summary: "Bull case for data-center spend.",
      }),
    ).toBe("NVIDIA - Bull Case");
  });

  it("uses cleaned headline + company when classification is generic", () => {
    expect(
      formatSeekingAlphaTitle({
        title: "Tesla Stock: Robotaxi Timeline Still Unclear",
        companyName: "Tesla, Inc.",
        symbol: "TSLA",
        eventCategory: "news",
        subcategory: "company_news",
      }),
    ).toBe("Tesla - Robotaxi Timeline Still Unclear");
  });

  it("keeps thematic invest pieces readable without a fake clinical label", () => {
    expect(
      formatSeekingAlphaTitle({
        title: "Where To Invest Now In AI, Biotech, Small Caps, And Gold",
        companyName: "ABBV",
        symbol: "ABBV",
        eventCategory: "clinical",
        subcategory: "clinical_news",
      }),
    ).toBe("Where To Invest Now In AI, Biotech, Small Caps, And Gold");
  });

  it("formats downgrades and price-target moves", () => {
    expect(
      formatSeekingAlphaTitle({
        title: "Downgrading Meta To Sell On Ad Fatigue",
        companyName: "Meta Platforms",
        symbol: "META",
        subcategory: "downgrade",
      }),
    ).toBe("Meta Platforms - Downgraded to Sell");

    expect(
      formatSeekingAlphaTitle({
        title: "Street Raises PT On Microsoft After Azure Beat",
        companyName: "Microsoft",
        symbol: "MSFT",
        subcategory: "price_target",
      }),
    ).toBe("Microsoft - Price Target Raised");
  });
});
