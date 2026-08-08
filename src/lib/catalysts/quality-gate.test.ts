import { describe, expect, it } from "vitest";

import { RETENTION_DAYS } from "@/lib/jobs/data-retention";

import { evaluateCatalystQuality } from "./quality-gate";

describe("evaluateCatalystQuality", () => {
  it("drops generic news firehose", () => {
    expect(
      evaluateCatalystQuality({
        provider: "finnhub",
        eventCategory: "news",
        symbol: "AAPL",
      }).decision,
    ).toBe("drop");
  });

  it("keeps PR-wire press releases with substantive facts even when category is news", () => {
    expect(
      evaluateCatalystQuality({
        provider: "pr-wire",
        eventCategory: "news",
        subcategory: "pr_wire",
        symbol: "AAPL",
        headline: "Apple announces $2B share repurchase authorization",
        summary:
          "Apple Inc. announced a new $2 billion share repurchase program after the close.",
      }).decision,
    ).toBe("keep");
  });

  it("drops thin PR-wire / news without facts", () => {
    expect(
      evaluateCatalystQuality({
        provider: "pr-wire",
        eventCategory: "news",
        subcategory: "pr_wire",
        symbol: "AAPL",
      }).decision,
    ).toBe("drop");
  });

  it("keeps SEC disclosure with a gold item even when Atom summary is AccNo-thin", () => {
    // Enrichment fills body later — do not drop pre-enrich gold filings.
    expect(
      evaluateCatalystQuality({
        provider: "sec-edgar",
        eventCategory: "disclosure",
        symbol: "ACME",
        itemCodes: [
          { code: "1.01", label: "Material agreement", category: "deals" },
        ],
        headline: "8-K filing",
        summary: "Filed: 2026-07-24 AccNo: 0000950103-26-011123 Size: 12 KB",
      }).decision,
    ).toBe("keep");
  });

  it("keeps near-term earnings with symbol", () => {
    expect(
      evaluateCatalystQuality({
        provider: "finnhub",
        eventCategory: "earnings",
        subcategory: "bmo",
        symbol: "AAPL",
      }).decision,
    ).toBe("keep");
  });

  it("drops Finnhub recommendation trend snapshots", () => {
    expect(
      evaluateCatalystQuality({
        provider: "finnhub",
        eventCategory: "analyst",
        subcategory: "recommendation_trend",
        symbol: "AAPL",
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
        symbol: "AAPL",
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
        symbol: "AAPL",
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
        symbol: "AAPL",
      }).decision,
    ).toBe("drop");
  });

  it("drops boilerplate 8-K (7.01/8.01/9.01 only)", () => {
    expect(
      evaluateCatalystQuality({
        provider: "sec-edgar",
        eventCategory: "disclosure",
        symbol: "ACME",
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
        symbol: "ACME",
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
        symbol: "ACME",
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
        symbol: "ACME",
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
        symbol: "AAPL",
      }).decision,
    ).toBe("drop");
  });

  it("keeps Form 4 open-market buy", () => {
    expect(
      evaluateCatalystQuality({
        provider: "sec-edgar",
        eventCategory: "insider",
        subcategory: "insider_buy",
        symbol: "AAPL",
      }).decision,
    ).toBe("keep");
  });

  it("drops openFDA / ClinicalTrials without symbol", () => {
    expect(
      evaluateCatalystQuality({
        provider: "openfda",
        eventCategory: "regulatory",
        subcategory: "openfda_approval",
        symbol: null,
        headline: "FDA original approval",
        summary: "ORIG · AP",
      }).decision,
    ).toBe("drop");
  });

  it("keeps openFDA ORIG with symbol", () => {
    expect(
      evaluateCatalystQuality({
        provider: "openfda",
        eventCategory: "regulatory",
        subcategory: "openfda_approval",
        symbol: "MRK",
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
        symbol: "MRK",
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
        symbol: "MRK",
        headline: "Recruiting",
      }).decision,
    ).toBe("drop");
  });

  it("keeps ClinicalTrials completed with symbol", () => {
    expect(
      evaluateCatalystQuality({
        provider: "clinicaltrials",
        eventCategory: "clinical",
        symbol: "MRK",
        headline: "Completed",
      }).decision,
    ).toBe("keep");
  });

  it("drops Form4API duplicates", () => {
    expect(
      evaluateCatalystQuality({
        provider: "form4api",
        eventCategory: "insider",
        symbol: "AAPL",
      }).decision,
    ).toBe("drop");
  });

  it("keeps Nasdaq halts", () => {
    expect(
      evaluateCatalystQuality({
        provider: "nasdaq-halts",
        eventCategory: "trading_halt",
        subcategory: "halt",
        symbol: "GME",
      }).decision,
    ).toBe("keep");
  });

  it("keeps macro calendar", () => {
    expect(
      evaluateCatalystQuality({
        provider: "macro-calendar",
        eventCategory: "macro",
        subcategory: "cpi",
        symbol: null,
      }).decision,
    ).toBe("keep");
  });

  it("drops non-wire Polygon without catalyst category", () => {
    expect(
      evaluateCatalystQuality({
        provider: "polygon",
        eventCategory: "governance",
        subcategory: "company_news",
        symbol: "AAPL",
      }).decision,
    ).toBe("drop");
  });

  it("keeps Benzinga wire even if category is analyst", () => {
    expect(
      evaluateCatalystQuality({
        provider: "polygon",
        eventCategory: "analyst",
        subcategory: "benzinga_wire",
        symbol: "AAPL",
      }).decision,
    ).toBe("keep");
  });
});
