import { describe, expect, it } from "vitest";

import {
  buildEarningsIntro,
  earningsFiguresToCard,
  finnhubStockEarningsToFigures,
  isEarningsCatalyst,
  mergeEarningsFigures,
  parseEarningsFromRaw,
  resolveArticleDetailCards,
} from "./article-detail";

describe("isEarningsCatalyst", () => {
  it("detects category, Finnhub subcategory, Item 2.02, and type", () => {
    expect(isEarningsCatalyst({ eventCategory: "earnings" })).toBe(true);
    expect(
      isEarningsCatalyst({ subcategory: "bmo", provider: "finnhub" }),
    ).toBe(true);
    expect(isEarningsCatalyst({ type: "Earnings" })).toBe(true);
    expect(
      isEarningsCatalyst({
        itemCodes: [{ code: "2.02", label: "Earnings / results" }],
      }),
    ).toBe(true);
    expect(isEarningsCatalyst({ eventCategory: "news" })).toBe(false);
  });
});

describe("parseEarningsFromRaw", () => {
  it("parses Finnhub calendar payload with actual/estimate and surprise", () => {
    const figures = parseEarningsFromRaw({
      symbol: "NVDA",
      date: "2026-08-01",
      hour: "amc",
      quarter: 2,
      year: 2026,
      epsActual: 1.01,
      epsEstimate: 0.96,
      revenueActual: 30_000_000_000,
      revenueEstimate: 28_500_000_000,
    });

    expect(figures).not.toBeNull();
    expect(figures!.epsActual).toBe(1.01);
    expect(figures!.epsEstimate).toBe(0.96);
    expect(figures!.epsBeatMiss).toBe("beat");
    expect(figures!.epsSurprisePct).toBeCloseTo(
      ((1.01 - 0.96) / 0.96) * 100,
      5,
    );
    expect(figures!.revenueBeatMiss).toBe("beat");
    expect(figures!.period).toBe("Q2 2026");
    expect(figures!.hour).toBe("amc");
  });

  it("parses nested earningsCalendar array", () => {
    const figures = parseEarningsFromRaw({
      earningsCalendar: [
        {
          symbol: "AAPL",
          date: "2026-07-31",
          epsEstimate: 1.4,
          epsActual: null,
        },
      ],
    });
    expect(figures?.epsEstimate).toBe(1.4);
    expect(figures?.epsActual).toBeNull();
    expect(figures?.epsBeatMiss).toBeNull();
  });

  it("marks miss when actual is below estimate", () => {
    const figures = parseEarningsFromRaw({
      epsActual: 0.8,
      epsEstimate: 1.0,
    });
    expect(figures?.epsBeatMiss).toBe("miss");
    expect(figures?.epsSurprisePct).toBeCloseTo(-20, 5);
  });

  it("reads guidance notes when present", () => {
    const figures = parseEarningsFromRaw({
      epsActual: 2,
      epsEstimate: 2,
      guidance: "Raises FY EPS guidance to $4.10–$4.20",
    });
    expect(figures?.epsBeatMiss).toBe("inline");
    expect(figures?.guidance).toMatch(/Raises FY/);
  });

  it("returns null when raw has no earnings fields", () => {
    expect(parseEarningsFromRaw({ headline: "Random news" })).toBeNull();
    expect(parseEarningsFromRaw(null)).toBeNull();
  });
});

describe("finnhubStockEarningsToFigures", () => {
  it("maps /stock/earnings rows with labeled Actual / Estimate / Surprise", () => {
    const figures = finnhubStockEarningsToFigures({
      actual: 1.52,
      estimate: 1.43,
      period: "2026-03-31",
      quarter: 1,
      surprise: 0.09,
      surprisePercent: 6.2937,
      symbol: "AAPL",
      year: 2026,
    });

    expect(figures.source).toBe("enriched");
    expect(figures.epsActual).toBe(1.52);
    expect(figures.epsEstimate).toBe(1.43);
    expect(figures.epsSurprisePct).toBeCloseTo(6.2937, 4);
    expect(figures.epsBeatMiss).toBe("beat");
    expect(figures.period).toBe("Q1 2026");

    const card = earningsFiguresToCard(figures, { ticker: "AAPL" });
    expect(card.title).toBe("Earnings results");
    expect(card.fields.some((f) => f.label === "EPS actual")).toBe(true);
    expect(card.fields.some((f) => f.label === "EPS estimate")).toBe(true);
    expect(card.fields.some((f) => f.label === "EPS surprise")).toBe(true);
    expect(card.intro).toMatch(/AAPL|beat/i);
  });
});

describe("mergeEarningsFigures", () => {
  it("keeps raw figures and fills gaps from enrichment", () => {
    const raw = parseEarningsFromRaw({
      epsEstimate: 0.96,
      revenueEstimate: 1e9,
      hour: "bmo",
      date: "2026-08-01",
    });
    const enriched = finnhubStockEarningsToFigures({
      actual: 1.01,
      estimate: 0.95,
      quarter: 2,
      year: 2026,
      surprisePercent: 5.2,
    });

    const merged = mergeEarningsFigures(raw, enriched);
    expect(merged?.epsEstimate).toBe(0.96); // raw wins
    expect(merged?.epsActual).toBe(1.01); // filled from enriched
    expect(merged?.hour).toBe("bmo");
    expect(merged?.quarter).toBe(2);
    expect(merged?.source).toBe("merged");
  });
});

describe("buildEarningsIntro", () => {
  it("explains beat with surprise in plain language", () => {
    const intro = buildEarningsIntro(
      {
        epsActual: 1.01,
        epsEstimate: 0.96,
        epsSurprisePct: ((1.01 - 0.96) / 0.96) * 100,
        epsBeatMiss: "beat",
        period: "Q2 2026",
        source: "raw",
      },
      { ticker: "NVDA", companyName: "NVIDIA Corp" },
    );
    expect(intro).toMatch(/NVIDIA Corp \(NVDA\)/);
    expect(intro).toMatch(/Q2 2026/);
    expect(intro).toMatch(/beat/i);
    expect(intro).toMatch(/1\.01/);
    expect(intro).toMatch(/0\.96/);
  });

  it("explains scheduled estimate-only entries", () => {
    const intro = buildEarningsIntro(
      {
        epsEstimate: 2.1,
        hour: "amc",
        source: "raw",
      },
      { ticker: "MSFT" },
    );
    expect(intro).toMatch(/scheduled/i);
    expect(intro).toMatch(/2\.1/);
    expect(intro).toMatch(/after market close/i);
  });
});

describe("resolveArticleDetailCards", () => {
  it("builds earnings results card from Finnhub raw_content", () => {
    const cards = resolveArticleDetailCards({
      eventCategory: "earnings",
      provider: "finnhub",
      ticker: "NVDA",
      companyName: "NVIDIA Corp",
      type: "Earnings",
      rawContent: {
        symbol: "NVDA",
        date: "2026-08-01",
        hour: "amc",
        quarter: 2,
        year: 2026,
        epsActual: 1.01,
        epsEstimate: 0.96,
        revenueActual: 30_000_000_000,
        revenueEstimate: 28_500_000_000,
      },
    });

    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe("earnings");
    expect(cards[0].title).toBe("Earnings results");
    expect(cards[0].intro).toMatch(/beat|EPS/i);
    const labels = cards[0].fields.map((f) => f.label);
    expect(labels).toContain("EPS actual");
    expect(labels).toContain("EPS estimate");
    expect(labels).toContain("EPS surprise");
    expect(labels).toContain("Revenue actual");
  });

  it("still shows earnings panel for Item 2.02 without numeric figures", () => {
    const cards = resolveArticleDetailCards({
      eventCategory: "earnings",
      provider: "sec-edgar",
      ticker: "AAPL",
      type: "8-K",
      itemCodes: [{ code: "2.02", label: "Earnings / results" }],
      rawContent: { summary: "Item 2.02 Results of Operations." },
    });
    expect(cards[0]?.kind).toBe("earnings");
    expect(cards[0]?.intro).toMatch(/earnings/i);
  });

  it("builds halt detail card with reason and resumption", () => {
    const cards = resolveArticleDetailCards({
      eventCategory: "trading_halt",
      provider: "nasdaq-halts",
      ticker: "XYZ",
      rawContent: {
        reasonCode: "LULD",
        description: "Limit Up-Limit Down trading pause",
        resumptionTime: "2026-07-22T14:05:00Z",
      },
    });
    expect(cards.some((c) => c.kind === "halt")).toBe(true);
    const halt = cards.find((c) => c.kind === "halt")!;
    expect(halt.fields.some((f) => f.label === "Reason")).toBe(true);
    expect(halt.fields.some((f) => f.label === "Resumption")).toBe(true);
  });

  it("builds FDA detail card with designation", () => {
    const cards = resolveArticleDetailCards({
      eventCategory: "regulatory",
      provider: "finnhub",
      subcategory: "fda_calendar",
      rawContent: {
        drug: "DrugX",
        indication: "Oncology",
        status: "Pending",
        catalyst: "PDUFA date",
        designation: "Breakthrough Therapy",
      },
    });
    const fda = cards.find((c) => c.kind === "fda");
    expect(fda).toBeTruthy();
    expect(fda!.fields.some((f) => f.label === "Designation")).toBe(true);
  });
});
