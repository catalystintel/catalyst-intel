import { describe, expect, it } from "vitest";

import type { FeedCatalyst } from "./feed-catalyst";
import {
  eventLabel,
  looksLikeSourceLabel,
  matchesFeedSearchQuery,
  sectorLabel,
  sectorTone,
  sourceDisplay,
  stripSourceNames,
  titleLine,
  titleTooltipLine,
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
    materialityReasons: [],
    aiBullets: null,
    aiLean: null,
    aiUncertain: null,
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
  it("composes company + catalog event when headline is a short 8-K label", () => {
    expect(titleLine(base())).toBe("NVIDIA Corp — Earnings / results");
    expect(titleLine(base({ headline: null }))).toBe(
      "NVIDIA Corp — 8-K filing",
    );
  });

  it("prefers official SEC item blurb over the short catalog label", () => {
    expect(
      titleLine(
        base({
          companyName: "Liberty Global Ltd",
          ticker: "LBTYK",
          headline: "Earnings / results",
          items: [
            {
              code: "2.02",
              label: "Earnings / results",
              category: "earnings",
            },
          ],
          summary:
            "Filed: 2026-07-24 AccNo: 000123 Size: 10 KB " +
            "Item 2.02: Results of Operations and Financial Condition " +
            "Item 9.01: Financial Statements and Exhibits",
        }),
      ),
    ).toBe(
      "Liberty Global Ltd — Results of Operations and Financial Condition",
    );
  });

  it("tooltip title keeps longer SEC notices than the tape line", () => {
    const long =
      "Notice of Delisting or Failure to Satisfy a Continued Listing Rule or Standard; Transfer of Listing. This is a longer continuation of the official Item text for traders.";
    const row = base({
      companyName: "Quantum-Si Inc",
      ticker: "QSI",
      headline: "Delisting risk",
      eventCategory: "distress",
      items: [{ code: "3.01", label: "Delisting risk", category: "distress" }],
      summary: `Item 3.01: ${long}`,
    });
    const tape = titleLine(row);
    const tip = titleTooltipLine(row);
    expect(tape.length).toBeLessThan(tip.length);
    expect(tip).toContain("Transfer of Listing");
    expect(tip).toContain("longer continuation");
  });

  it("keeps specific news headlines without forcing company prefix", () => {
    expect(
      titleLine(
        base({
          headline: "NVDA raises data-center outlook after strong quarter",
          title: "ignored",
        }),
      ),
    ).toBe("NVDA raises data-center outlook after strong quarter");
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
      "Halt resumed",
    );
  });

  it("maps known subcategories to readable labels", () => {
    expect(eventLabel(base({ subcategory: "insider_buy" }))).toBe(
      "Insider buy",
    );
    expect(eventLabel(base({ subcategory: "insider_sell" }))).toBe(
      "Insider sell",
    );
    expect(eventLabel(base({ subcategory: "upgrade" }))).toBe("Upgrade");
    expect(eventLabel(base({ subcategory: "downgrade" }))).toBe("Downgrade");
    expect(eventLabel(base({ subcategory: "price_target" }))).toBe(
      "Price target",
    );
    expect(eventLabel(base({ subcategory: "ipo_priced" }))).toBe("IPO priced");
    expect(eventLabel(base({ subcategory: "ipo_filed" }))).toBe("IPO filed");
  });
});

describe("matchesFeedSearchQuery", () => {
  it("matches ticker, company name, and title case-insensitively", () => {
    const row = base({
      ticker: "TSLA",
      companyName: "Tesla, Inc.",
      title: "Form 4 insider transaction",
      headline: "CEO sells shares",
    });
    expect(matchesFeedSearchQuery(row, "tsla")).toBe(true);
    expect(matchesFeedSearchQuery(row, "tesla")).toBe(true);
    expect(matchesFeedSearchQuery(row, "INSIDER")).toBe(true);
    expect(matchesFeedSearchQuery(row, "ceo sells")).toBe(true);
    expect(matchesFeedSearchQuery(row, "nvidia")).toBe(false);
  });

  it("empty query matches everything", () => {
    expect(matchesFeedSearchQuery(base(), "   ")).toBe(true);
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
