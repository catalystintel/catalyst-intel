import { describe, expect, it } from "vitest";

import { RETENTION_DAYS } from "@/lib/jobs/data-retention";

import {
  companyNewsToNormalized,
  earningsToNormalized,
  fdaToNormalized,
  ipoToNormalized,
  priceTargetToNormalized,
  recommendationToNormalized,
} from "./fetch-finnhub-catalysts";

describe("earningsToNormalized", () => {
  it("formats Earnings Report Qn - Company Name", () => {
    const item = earningsToNormalized(
      {
        symbol: "AAPL",
        date: "2026-01-28",
        quarter: 1,
        year: 2026,
        hour: "amc",
        epsEstimate: 2.1,
      },
      "Apple Inc.",
    );
    expect(item).toMatchObject({
      provider: "finnhub",
      symbol: "AAPL",
      companyName: "Apple Inc.",
      type: "Earnings",
      title: "Apple Inc. - Earnings Report Q1",
      headline: "Apple Inc. - Earnings Report Q1",
      eventCategory: "earnings",
      subcategory: "amc",
    });
  });

  it("derives quarter from date and falls back to symbol for the name", () => {
    const item = earningsToNormalized({
      symbol: "MSFT",
      date: "2026-04-24",
      hour: "bmo",
    });
    expect(item?.title).toBe("MSFT - Earnings Report Q2");
    expect(item?.companyName).toBe("MSFT");
  });
});

describe("fdaToNormalized", () => {
  it("uses FDA Approval title for approval-like calendar rows", () => {
    const item = fdaToNormalized({
      symbol: "PFE",
      company: "Pfizer Inc",
      drug: "DrugX",
      catalyst: "FDA approval decision",
      status: "Approved",
      date: "2026-07-20",
    });
    expect(item).toMatchObject({
      type: "FDA Approval",
      title: "Pfizer Inc Receives FDA Approval!",
      headline: "Pfizer Inc Receives FDA Approval!",
      subcategory: "fda_approval",
    });
  });

  it("keeps non-approval FDA calendar titles", () => {
    const item = fdaToNormalized({
      symbol: "MRNA",
      company: "Moderna Inc",
      drug: "VaccineY",
      catalyst: "Advisory committee",
      date: "2026-07-21",
    });
    expect(item?.type).toBe("FDA Calendar");
    expect(item?.title).toBe("Moderna Inc — VaccineY");
  });
});

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
      symbol: "NVDA",
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
      symbol: "NVDA",
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
      symbol: "ACME",
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
