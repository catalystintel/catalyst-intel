import { describe, expect, it } from "vitest";

import { RETENTION_DAYS } from "@/lib/jobs/data-retention";

import {
  companyNewsToNormalized,
  ipoToNormalized,
  priceTargetToNormalized,
  recommendationToNormalized,
} from "./fetch-finnhub-catalysts";

describe("recommendationToNormalized", () => {
  it("maps Finnhub consensus into Analyst Actions", () => {
    const item = recommendationToNormalized("NVDA", {
      period: "2026-07-01",
      strongBuy: 20,
      buy: 15,
      hold: 5,
      sell: 1,
      strongSell: 0,
    });
    expect(item).toMatchObject({
      provider: "finnhub",
      ticker: "NVDA",
      eventCategory: "analyst",
      subcategory: "recommendation_trend",
      type: "Analyst Actions",
    });
    expect(item?.summary).toMatch(/Bullish skew/);
    expect(item?.externalId).toBe("finnhub:rec:NVDA:2026-07-01");
  });
});

describe("priceTargetToNormalized", () => {
  const now = new Date("2026-07-24T12:00:00.000Z");

  it("maps recent Street PT into Analyst Actions", () => {
    const item = priceTargetToNormalized(
      "AAPL",
      {
        lastUpdated: "2026-07-20",
        targetMean: 240,
        targetMedian: 235,
        targetHigh: 300,
        targetLow: 180,
      },
      { now },
    );
    expect(item).toMatchObject({
      eventCategory: "analyst",
      subcategory: "price_target",
      type: "Analyst Actions",
    });
    expect(item?.summary).toContain("Mean $240");
  });

  it("returns null without targets", () => {
    expect(
      priceTargetToNormalized("AAPL", { lastUpdated: "2026-07-20" }, { now }),
    ).toBeNull();
  });

  it("returns null without lastUpdated", () => {
    expect(
      priceTargetToNormalized("AAPL", { targetMean: 200 }, { now }),
    ).toBeNull();
  });

  it("returns null when lastUpdated is outside retention", () => {
    const stale = new Date(now);
    stale.setUTCDate(stale.getUTCDate() - (RETENTION_DAYS + 1));
    const staleYmd = stale.toISOString().slice(0, 10);
    expect(
      priceTargetToNormalized(
        "AAPL",
        { lastUpdated: staleYmd, targetMean: 200 },
        { now },
      ),
    ).toBeNull();
  });
});

describe("companyNewsToNormalized", () => {
  it("ingests classified headlines only", () => {
    const item = companyNewsToNormalized({
      id: 42,
      headline: "Analyst upgrades NVDA, raises PT",
      related: "NVDA",
      datetime: Math.floor(new Date("2026-07-20T12:00:00Z").getTime() / 1000),
      summary: "Street lifts target.",
      source: "Reuters",
    });
    expect(item).toMatchObject({
      provider: "finnhub",
      ticker: "NVDA",
      eventCategory: "analyst",
      subcategory: "upgrade",
    });
  });

  it("drops generic company news", () => {
    expect(
      companyNewsToNormalized({
        id: 1,
        headline: "Company announces partnership",
        related: "ACME",
        datetime: 1_753_000_000,
      }),
    ).toBeNull();
  });
});

describe("ipoToNormalized", () => {
  it("maps priced IPO status", () => {
    expect(
      ipoToNormalized({
        symbol: "ACME",
        name: "Acme Corp",
        date: "2026-08-01",
        status: "Priced",
        exchange: "NASDAQ",
        price: 18,
      }),
    ).toMatchObject({
      eventCategory: "capital",
      subcategory: "ipo_priced",
      ticker: "ACME",
    });
  });

  it("maps filed IPO status", () => {
    expect(
      ipoToNormalized({
        symbol: "NEWCO",
        name: "NewCo",
        date: "2026-08-15",
        status: "Filed",
      }),
    ).toMatchObject({
      subcategory: "ipo_filed",
    });
  });

  it("maps withdrawn IPO status", () => {
    expect(
      ipoToNormalized({
        name: "Withdrawn Inc",
        date: "2026-09-01",
        status: "Withdrawn",
      }),
    ).toMatchObject({
      subcategory: "ipo_withdrawn",
    });
  });

  it("returns null without date", () => {
    expect(ipoToNormalized({ symbol: "X", status: "Filed" })).toBeNull();
  });
});
