import { describe, expect, it } from "vitest";

import {
  ensureIngestSummary,
  extractArticleBody,
  extractiveSummary,
  isWeakSummary,
  originalSourceLabel,
  resolveArticleSummary,
  stripHtml,
  synthesizeReadableSummary,
} from "./article-content";

describe("stripHtml", () => {
  it("removes tags and decodes common entities", () => {
    expect(stripHtml("<p>Item&nbsp;2.02 &amp; results</p>")).toBe(
      "Item 2.02 & results",
    );
  });
});

describe("extractiveSummary", () => {
  it("keeps the first few sentences", () => {
    const text =
      "Alpha Corp reported Q2 revenue above estimates. Guidance was raised for the full year. Analysts remain mixed. Extra sentence ignored.";
    const summary = extractiveSummary(text, { maxSentences: 2 });
    expect(summary).toContain("Alpha Corp reported");
    expect(summary).toContain("Guidance was raised");
    expect(summary).not.toContain("Analysts remain mixed");
  });

  it("truncates very long paragraphs without sentence breaks", () => {
    const text = "word ".repeat(200).trim();
    const summary = extractiveSummary(text, { maxChars: 80 });
    expect(summary.length).toBeLessThanOrEqual(81);
    expect(summary.endsWith("…")).toBe(true);
  });
});

describe("extractArticleBody", () => {
  it("reads SEC Atom summary from raw_content", () => {
    const result = extractArticleBody({
      provider: "sec-edgar",
      rawContent: {
        title: "Acme 8-K",
        summary: "<p>Item 2.02 Results of Operations.</p>",
      },
      summary: null,
      title: "Acme — 8-K filing",
    });
    expect(result.source).toBe("raw");
    expect(result.body).toContain("Item 2.02");
  });

  it("never returns AccNo/Size Atom blob as article body", () => {
    const atom = "Filed: 2026-07-24 AccNo: 0001193125-26-316280 Size: 973 KB";
    const result = extractArticleBody({
      provider: "sec-edgar",
      rawContent: {
        summary: atom,
        formType: "424B2",
        extracted: {
          completeness: "thin",
          investorSummary:
            "Citigroup Inc. (C-PR) filed a 424B2 prospectus supplement (capital markets).",
          bodySnippets: [],
          keyFacts: [
            { label: "Form", value: "424B2" },
            { label: "Type", value: "Prospectus supplement" },
          ],
        },
      },
      summary: atom,
      title: "C-PR — Prospectus supplement (424B2)",
    });
    expect(result.body).not.toMatch(/AccNo/i);
    expect(result.body).not.toMatch(/Size:\s*\d/i);
    expect(result.body).toMatch(/prospectus|424B2|capital/i);
  });

  it("reads Polygon description", () => {
    const result = extractArticleBody({
      provider: "polygon",
      rawContent: {
        title: "Wire headline",
        description: "Benzinga notes a surprise FDA panel vote.",
      },
    });
    expect(result.body).toContain("FDA panel");
  });

  it("falls back to stored summary then title", () => {
    expect(
      extractArticleBody({
        provider: "unknown",
        rawContent: {},
        summary: "Stored vendor blurb for traders.",
        title: "Title only",
      }).source,
    ).toBe("summary");

    expect(
      extractArticleBody({
        provider: "unknown",
        rawContent: {},
        summary: null,
        title: "Only a title",
        headline: "Short label",
      }),
    ).toMatchObject({ source: "title" });
  });
});

describe("isWeakSummary", () => {
  it("flags empty, short, and jargon-only blurbs", () => {
    expect(isWeakSummary(null)).toBe(true);
    expect(isWeakSummary("Trading halt")).toBe(true);
    expect(isWeakSummary("AAPL — 8-K")).toBe(true);
    expect(
      isWeakSummary("Officer / director change — Tesla, Inc. — 8-K filing"),
    ).toBe(true);
    expect(
      isWeakSummary(
        "The company disclosed a material agreement with a strategic partner and expects closing next quarter.",
      ),
    ).toBe(false);
  });
});

describe("resolveArticleSummary", () => {
  it("uses a substantial stored summary as-is (extractive)", () => {
    const stored =
      "The company disclosed a material agreement with a strategic partner. Closing is expected next quarter pending regulatory review.";
    const result = resolveArticleSummary({ summary: stored, title: "Deal" });
    expect(result.generated).toBe(false);
    expect(result.summary).toContain("material agreement");
  });

  it("generates from body when summary is empty", () => {
    const body =
      "Trading resumed after a volatility halt. Volume spiked into the open. Market makers widened spreads briefly.";
    const result = resolveArticleSummary({
      summary: null,
      title: "Halt resumed",
      body,
    });
    expect(result.generated).toBe(true);
    expect(result.summary).toContain("Trading resumed");
  });

  it("synthesizes when both summary and body are empty but metadata exists", () => {
    const result = resolveArticleSummary({
      summary: null,
      body: null,
      title: "AAPL — 8-K filing",
      headline: "Earnings / results",
      symbol: "AAPL",
      companyName: "Apple Inc",
      eventCategory: "earnings",
      type: "8-K",
      provider: "sec-edgar",
      itemCodes: [{ code: "2.02", label: "Earnings / results" }],
    });
    expect(result.generated).toBe(true);
    expect(result.summary.length).toBeGreaterThan(40);
    expect(result.summary).toMatch(/Apple|AAPL/i);
    expect(result.summary).toMatch(/Item 2\.02|earnings/i);
  });
});

describe("ensureIngestSummary / provider samples", () => {
  it("fills summary for Form 4-style rows with no vendor summary", () => {
    const summary = ensureIngestSummary({
      summary: null,
      title: "AAPL — Form 4",
      headline: "Open market purchase",
      provider: "form4api",
      symbol: "AAPL",
      companyName: "Apple Inc",
      eventCategory: "insider",
      type: "Form 4",
      rawContent: {
        transactionType: "Purchase",
        companyName: "Apple Inc",
        filedAt: "2026-07-20T12:00:00Z",
      },
    });
    expect(summary).toBeTruthy();
    expect(summary!).toMatch(/Purchase|Apple|AAPL|insider/i);
  });

  it("SEC empty Atom still yields understandable item-based summary", () => {
    const summary = ensureIngestSummary({
      summary: null,
      title: "Tesla, Inc. — 8-K filing",
      headline: "Officer / director change",
      provider: "sec-edgar",
      symbol: "TSLA",
      companyName: "Tesla, Inc.",
      eventCategory: "management",
      type: "8-K",
      itemCodes: [{ code: "5.02", label: "Officer / director change" }],
      rawContent: { title: "8-K", summary: "" },
    });
    expect(summary).toBeTruthy();
    expect(summary!).toMatch(/Tesla|TSLA/i);
    expect(summary!).toMatch(/Item 5\.02|officer|director|management/i);
    expect(summary!).toMatch(/\./);
    expect(summary!.split(/(?<=[.!?])\s+/).length).toBeGreaterThanOrEqual(2);
    expect(isWeakSummary(summary)).toBe(false);
  });

  it("Nasdaq halt with thin description still explains the halt", () => {
    const summary = ensureIngestSummary({
      summary: "XYZ",
      title: "XYZ — Trading halt",
      headline: "Trading halt",
      provider: "nasdaq-halts",
      symbol: "XYZ",
      companyName: "XYZ",
      eventCategory: "trading_halt",
      subcategory: "halt",
      type: "Trading Halt",
      rawContent: {
        title: "XYZ Trading Halt",
        description: "LULD",
      },
    });
    expect(summary).toBeTruthy();
    expect(summary!).toMatch(/XYZ/i);
    expect(summary!).toMatch(/halt/i);
    expect(summary!.length).toBeGreaterThan(40);
    expect(summary!.split(/(?<=[.!?])\s+/).length).toBeGreaterThanOrEqual(2);
    expect(isWeakSummary(summary)).toBe(false);
  });

  it("Finnhub earnings with null summary still includes EPS context", () => {
    const summary = ensureIngestSummary({
      summary: null,
      title: "NVDA — Earnings 2026-08-01",
      headline: "Earnings",
      provider: "finnhub",
      symbol: "NVDA",
      companyName: "NVIDIA Corp",
      eventCategory: "earnings",
      type: "Earnings",
      rawContent: {
        symbol: "NVDA",
        date: "2026-08-01",
        epsEstimate: 0.96,
        epsActual: 1.01,
      },
    });
    expect(summary).toBeTruthy();
    expect(summary!).toMatch(/NVDA|NVIDIA/i);
    expect(summary!).toMatch(/EPS|earnings/i);
    expect(summary!.split(/(?<=[.!?])\s+/).length).toBeGreaterThanOrEqual(2);
    expect(isWeakSummary(summary)).toBe(false);
  });

  it("Polygon empty description still yields readable news summary", () => {
    const summary = ensureIngestSummary({
      summary: null,
      title: "Acme wins major defense contract",
      headline: "Defense contract win",
      provider: "polygon",
      symbol: "ACME",
      companyName: "Acme Dynamics",
      eventCategory: "news",
      type: "News",
      rawContent: {
        title: "Acme wins major defense contract",
        description: "",
      },
    });
    expect(summary).toBeTruthy();
    expect(summary!).toMatch(/ACME|Acme/i);
    expect(summary!).toMatch(/news|contract|article/i);
    expect(summary!.split(/(?<=[.!?])\s+/).length).toBeGreaterThanOrEqual(2);
    expect(isWeakSummary(summary)).toBe(false);
  });
});

describe("synthesizeReadableSummary", () => {
  it("never returns empty when symbol + category exist", () => {
    const text = synthesizeReadableSummary({
      symbol: "MSFT",
      eventCategory: "disclosure",
      title: "MSFT — 8-K",
      provider: "sec-edgar",
      type: "8-K",
    });
    expect(text.length).toBeGreaterThan(20);
    expect(text).toMatch(/MSFT/i);
  });
});

describe("originalSourceLabel", () => {
  it("labels SEC distinctly from generic news", () => {
    expect(originalSourceLabel("sec-edgar")).toBe("Original on SEC EDGAR");
    expect(originalSourceLabel("polygon")).toBe("Original article");
    expect(originalSourceLabel(null)).toBe("View original source");
  });
});
