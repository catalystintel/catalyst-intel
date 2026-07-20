import { describe, expect, it } from "vitest";

import type { FeedCatalyst } from "./feed-catalyst";
import {
  sectorLabel,
  sectorTone,
  sourceDisplay,
  titleLine,
} from "./feed-display";

function base(overrides: Partial<FeedCatalyst> = {}): FeedCatalyst {
  return {
    id: 1,
    ticker: "NVDA",
    companyName: "NVIDIA Corp",
    type: "8-K",
    title: "NVIDIA Corp — 8-K filing",
    headline: "Earnings / results",
    eventCategory: "earnings",
    items: [],
    timestamp: "2026-07-20T14:23:00.000Z",
    summary: null,
    impactScore: null,
    sourceUrl: "https://example.com",
    sourceProvider: "sec-edgar",
    sector: null,
    ...overrides,
  };
}

describe("sourceDisplay", () => {
  it("maps sec-edgar to SEC EDGAR with type · ticker meta", () => {
    expect(sourceDisplay(base())).toMatchObject({
      name: "SEC EDGAR",
      meta: "8-K · NVDA",
      initial: "S",
      tone: "sec",
    });
  });
});

describe("sectorLabel", () => {
  it("prefers company sector", () => {
    expect(sectorLabel(base({ sector: "Technology" }))).toBe("Technology");
  });

  it("falls back to event category, then SEC Filings", () => {
    expect(sectorLabel(base())).toBe("Earnings");
    expect(
      sectorLabel(base({ eventCategory: null, sector: null, type: "8-K" })),
    ).toBe("SEC Filings");
  });
});

describe("titleLine", () => {
  it("prefers headline over title", () => {
    expect(titleLine(base())).toBe("Earnings / results");
    expect(titleLine(base({ headline: null }))).toBe(
      "NVIDIA Corp — 8-K filing",
    );
  });
});

describe("sectorTone", () => {
  it("uses event category when present", () => {
    expect(sectorTone(base())).toBe("earnings");
    expect(sectorTone(base({ eventCategory: null, sector: "Tech" }))).toBe(
      "sector",
    );
  });
});
