import { describe, expect, it } from "vitest";

import type { FeedCatalyst } from "./feed-catalyst";
import {
  eventLabel,
  looksLikeSourceLabel,
  sectorLabel,
  sectorTone,
  sourceDisplay,
  stripSourceNames,
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
  it("prefers non-source headline over title", () => {
    expect(titleLine(base())).toBe("Earnings / results");
    expect(titleLine(base({ headline: null }))).toBe(
      "NVIDIA Corp — 8-K filing",
    );
  });

  it("skips publisher/source headlines and uses the story title", () => {
    expect(
      titleLine(
        base({
          sourceProvider: "finnhub",
          headline: "Benzinga",
          title: "NVDA raises data-center outlook",
        }),
      ),
    ).toBe("NVDA raises data-center outlook");

    expect(
      titleLine(
        base({
          sourceProvider: "polygon",
          headline: "Benzinga Wire",
          title: "FDA panel backs novel oncology therapy",
        }),
      ),
    ).toBe("FDA panel backs novel oncology therapy");

    expect(
      titleLine(
        base({
          sourceProvider: "finnhub",
          headline: "Company news",
          title: "Acme announces CFO transition",
        }),
      ),
    ).toBe("Acme announces CFO transition");
  });

  it("strips provider prefixes and suffixes from displayed titles", () => {
    expect(
      titleLine(
        base({
          headline: null,
          title: "Guidance raised — SEC EDGAR",
        }),
      ),
    ).toBe("Guidance raised");

    expect(
      titleLine(
        base({
          headline: "Finnhub: Street lifts price target",
          title: "ignored",
        }),
      ),
    ).toBe("Street lifts price target");

    expect(
      titleLine(
        base({
          headline: null,
          title: "Recall notice — openFDA",
        }),
      ),
    ).toBe("Recall notice");

    expect(
      titleLine(
        base({
          headline: null,
          title: "Material agreement — SEC",
        }),
      ),
    ).toBe("Material agreement");
  });
});

describe("stripSourceNames / looksLikeSourceLabel", () => {
  it("detects known source labels", () => {
    expect(looksLikeSourceLabel("SEC EDGAR")).toBe(true);
    expect(looksLikeSourceLabel("Benzinga Wire")).toBe(true);
    expect(looksLikeSourceLabel("Earnings / results")).toBe(false);
  });

  it("strips trailing and leading source chrome", () => {
    expect(stripSourceNames("Foo — Finnhub")).toBe("Foo");
    expect(stripSourceNames("openFDA: Bar")).toBe("Bar");
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
