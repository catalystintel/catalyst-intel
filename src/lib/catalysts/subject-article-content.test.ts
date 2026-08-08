import { describe, expect, it } from "vitest";

import {
  buildSubjectArticleLines,
  deriveSubjectTakeaways,
} from "./subject-article-content";

describe("buildSubjectArticleLines", () => {
  it("builds 3–6 earnings lines from keyFacts without inventing numbers", () => {
    const lines = buildSubjectArticleLines({
      eventCategory: "earnings",
      companyName: "Acme Corp",
      symbol: "ACME",
      keyFacts: [
        { label: "EPS", value: "$1.20 vs $1.10 est" },
        { label: "Revenue", value: "$4.1B vs $3.9B est" },
        { label: "Guidance", value: "Raised FY sales outlook" },
      ],
      summary: "Acme reported quarterly results after the close.",
    });
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.length).toBeLessThanOrEqual(6);
    expect(lines[0]).toMatch(/Acme Corp/i);
    expect(lines.some((l) => /EPS/i.test(l))).toBe(true);
    expect(lines.some((l) => /Revenue/i.test(l))).toBe(true);
    expect(lines.join(" ")).not.toMatch(/\$9\.99/);
  });

  it("uses distinct why-it-matters voice by subject", () => {
    const halt = buildSubjectArticleLines({
      eventCategory: "trading_halt",
      companyName: "GME",
      summary: "Trading halted pending news. Exchange: Nasdaq.",
    });
    const deals = buildSubjectArticleLines({
      eventCategory: "deals",
      companyName: "Acme",
      summary: "Acme announced it will acquire Rival for $2.0B in cash.",
      keyFacts: [{ label: "Deal value", value: "$2.0B" }],
    });
    expect(halt[0]).toMatch(/halt/i);
    expect(deals[0]).toMatch(/M&A|reprice/i);
    expect(halt[0]).not.toBe(deals[0]);
  });

  it("skips AccNo-only summaries", () => {
    const lines = buildSubjectArticleLines({
      eventCategory: "disclosure",
      summary: "Filed: 2026-07-24 AccNo: 0000950103-26-011123 Size: 12 KB",
      keyFacts: [{ label: "Event", value: "Material agreement disclosed" }],
    });
    expect(lines.every((l) => !/AccNo/i.test(l))).toBe(true);
    expect(lines.some((l) => /Material agreement/i.test(l))).toBe(true);
  });
});

describe("deriveSubjectTakeaways", () => {
  it("falls back to classic takeaways when facts are thin", () => {
    const lines = deriveSubjectTakeaways({
      eventCategory: "news",
      summary:
        "Alpha beat EPS. Revenue also beat. Guidance was raised. Extra ignored.",
    });
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.some((l) => /beat EPS/i.test(l))).toBe(true);
  });
});
