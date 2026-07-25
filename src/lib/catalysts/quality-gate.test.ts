import { describe, expect, it } from "vitest";

import { RETENTION_DAYS } from "@/lib/jobs/data-retention";

import { evaluateCatalystQuality } from "./quality-gate";

describe("evaluateCatalystQuality", () => {
  it("drops generic news firehose", () => {
    expect(
      evaluateCatalystQuality({
        provider: "finnhub",
        eventCategory: "news",
        ticker: "AAPL",
      }).decision,
    ).toBe("drop");
  });

  it("keeps near-term earnings with ticker", () => {
    expect(
      evaluateCatalystQuality({
        provider: "finnhub",
        eventCategory: "earnings",
        subcategory: "bmo",
        ticker: "AAPL",
      }).decision,
    ).toBe("keep");
  });

  it("drops Finnhub recommendation trend snapshots", () => {
    expect(
      evaluateCatalystQuality({
        provider: "finnhub",
        eventCategory: "analyst",
        subcategory: "recommendation_trend",
        ticker: "AAPL",
      }).decision,
    ).toBe("drop");
  });

  it("keeps recent Finnhub price targets within retention", () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      evaluateCatalystQuality({
        provider: "finnhub",
        eventCategory: "analyst",
        subcategory: "price_target",
        ticker: "AAPL",
        timestamp: recent,
      }).decision,
    ).toBe("keep");
  });

  it("drops stale Finnhub price targets outside retention", () => {
    const stale = new Date(
      Date.now() - (RETENTION_DAYS + 5) * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(
      evaluateCatalystQuality({
        provider: "finnhub",
        eventCategory: "analyst",
        subcategory: "price_target",
        ticker: "AAPL",
        timestamp: stale,
      }).decision,
    ).toBe("drop");
  });

  it("drops Finnhub price target without timestamp", () => {
    expect(
      evaluateCatalystQuality({
        provider: "finnhub",
        eventCategory: "analyst",
        subcategory: "price_target",
        ticker: "AAPL",
      }).decision,
    ).toBe("drop");
  });

  it("drops boilerplate 8-K (7.01/8.01/9.01 only)", () => {
    expect(
      evaluateCatalystQuality({
        provider: "sec-edgar",
        eventCategory: "disclosure",
        ticker: "ACME",
        itemCodes: [
          { code: "7.01", label: "Reg FD", category: "disclosure" },
          { code: "9.01", label: "Exhibits", category: "other" },
        ],
      }).decision,
    ).toBe("drop");
  });

  it("drops routine-only 8-K (mine safety / ethics / votes)", () => {
    expect(
      evaluateCatalystQuality({
        provider: "sec-edgar",
        eventCategory: "other",
        ticker: "ACME",
        itemCodes: [
          { code: "1.04", label: "Mine safety", category: "other" },
          { code: "9.01", label: "Exhibits", category: "other" },
        ],
      }).decision,
    ).toBe("drop");

    expect(
      evaluateCatalystQuality({
        provider: "sec-edgar",
        eventCategory: "governance",
        ticker: "ACME",
        itemCodes: [
          { code: "5.07", label: "Shareholder vote", category: "governance" },
        ],
      }).decision,
    ).toBe("drop");
  });

  it("keeps 8-K with a gold item even if exhibits tag along", () => {
    expect(
      evaluateCatalystQuality({
        provider: "sec-edgar",
        eventCategory: "earnings",
        ticker: "ACME",
        itemCodes: [
          { code: "2.02", label: "Earnings", category: "earnings" },
          { code: "9.01", label: "Exhibits", category: "other" },
        ],
      }).decision,
    ).toBe("keep");
  });

  it("drops Form 4 routine ownership paperwork", () => {
    expect(
      evaluateCatalystQuality({
        provider: "sec-edgar",
        eventCategory: "insider",
        subcategory: "form4_routine",
        ticker: "AAPL",
      }).decision,
    ).toBe("drop");
  });

  it("keeps Form 4 open-market buy", () => {
    expect(
      evaluateCatalystQuality({
        provider: "sec-edgar",
        eventCategory: "insider",
        subcategory: "insider_buy",
        ticker: "AAPL",
      }).decision,
    ).toBe("keep");
  });

  it("drops openFDA / ClinicalTrials without ticker", () => {
    expect(
      evaluateCatalystQuality({
        provider: "openfda",
        eventCategory: "regulatory",
        subcategory: "openfda_approval",
        ticker: null,
        headline: "FDA original approval",
        summary: "ORIG · AP",
      }).decision,
    ).toBe("drop");
  });

  it("keeps openFDA ORIG with ticker", () => {
    expect(
      evaluateCatalystQuality({
        provider: "openfda",
        eventCategory: "regulatory",
        subcategory: "openfda_approval",
        ticker: "MRK",
        headline: "FDA original approval",
        summary: "ORIG · AP · Drug",
      }).decision,
    ).toBe("keep");
  });

  it("drops openFDA SUPPL labeling noise", () => {
    expect(
      evaluateCatalystQuality({
        provider: "openfda",
        eventCategory: "regulatory",
        subcategory: "openfda_approval",
        ticker: "MRK",
        headline: "FDA approval update",
        summary: "SUPPL · AP · LABELING",
      }).decision,
    ).toBe("drop");
  });

  it("drops ClinicalTrials recruiting noise", () => {
    expect(
      evaluateCatalystQuality({
        provider: "clinicaltrials",
        eventCategory: "clinical",
        ticker: "MRK",
        headline: "Recruiting",
      }).decision,
    ).toBe("drop");
  });

  it("keeps ClinicalTrials completed with ticker", () => {
    expect(
      evaluateCatalystQuality({
        provider: "clinicaltrials",
        eventCategory: "clinical",
        ticker: "MRK",
        headline: "Completed",
      }).decision,
    ).toBe("keep");
  });

  it("drops Form4API duplicates", () => {
    expect(
      evaluateCatalystQuality({
        provider: "form4api",
        eventCategory: "insider",
        ticker: "AAPL",
      }).decision,
    ).toBe("drop");
  });

  it("keeps Nasdaq halts", () => {
    expect(
      evaluateCatalystQuality({
        provider: "nasdaq-halts",
        eventCategory: "trading_halt",
        subcategory: "halt",
        ticker: "GME",
      }).decision,
    ).toBe("keep");
  });

  it("keeps macro calendar", () => {
    expect(
      evaluateCatalystQuality({
        provider: "macro-calendar",
        eventCategory: "macro",
        subcategory: "cpi",
        ticker: null,
      }).decision,
    ).toBe("keep");
  });

  it("drops non-wire Polygon without catalyst category", () => {
    expect(
      evaluateCatalystQuality({
        provider: "polygon",
        eventCategory: "governance",
        subcategory: "company_news",
        ticker: "AAPL",
      }).decision,
    ).toBe("drop");
  });

  it("keeps Benzinga wire even if category is analyst", () => {
    expect(
      evaluateCatalystQuality({
        provider: "polygon",
        eventCategory: "analyst",
        subcategory: "benzinga_wire",
        ticker: "AAPL",
      }).decision,
    ).toBe("keep");
  });
});
