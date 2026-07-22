import { describe, expect, it } from "vitest";

import type { FeedCatalyst } from "./feed-catalyst";
import {
  eventLabel,
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
    subcategory: "8k",
    items: [],
    timestamp: "2026-07-20T14:23:00.000Z",
    summary: null,
    impactScore: null,
    confidence: 85,
    tags: ["8k"],
    historicalImpact: null,
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

  it("maps nasdaq-halts provider", () => {
    expect(
      sourceDisplay(
        base({ sourceProvider: "nasdaq-halts", type: "Trading Halt" }),
      ),
    ).toMatchObject({ name: "Nasdaq Halts", initial: "N" });
  });

  it("labels Polygon Benzinga wire as Wire", () => {
    expect(
      sourceDisplay(
        base({
          sourceProvider: "polygon",
          type: "Wire",
          headline: "Benzinga Wire",
          subcategory: "benzinga_wire",
        }),
      ),
    ).toMatchObject({
      name: "Benzinga Wire",
      initial: "B",
      tone: "wire",
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

describe("eventLabel", () => {
  it("prefers subcategory", () => {
    expect(eventLabel(base({ subcategory: "halt_resumed" }))).toBe(
      "halt resumed",
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
