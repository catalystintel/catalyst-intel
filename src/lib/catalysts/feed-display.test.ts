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
    symbol: "NVDA",
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
    keyFacts: [],
    ...overrides,
  };
}

describe("sourceDisplay", () => {
  it("maps sec-edgar to SEC EDGAR with type · symbol meta", () => {
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
  it("formats SEC earnings catalog rows as Company - Earnings Report Qn", () => {
    // Filing date 2026-07-20 → calendar Q3 heuristic when Finnhub quarter absent.
    expect(titleLine(base())).toBe("NVIDIA Corp - Earnings Report Q3");
    expect(
      titleLine(
        base({
          headline: null,
          eventCategory: null,
          items: [],
        }),
      ),
    ).toBe("NVIDIA Corp — 8-K filing");
  });

  it("rewrites Results of Operations blurbs to Company - Earnings Report Qn", () => {
    expect(
      titleLine(
        base({
          companyName: "Liberty Global Ltd",
          symbol: "LBTYK",
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
    ).toBe("Liberty Global Ltd - Earnings Report Q3");
  });

  it("uses ground-rule 8-K titles instead of raw Item blurbs", () => {
    const long =
      "Notice of Delisting or Failure to Satisfy a Continued Listing Rule or Standard; Transfer of Listing. This is a longer continuation of the official Item text for traders.";
    const row = base({
      companyName: "Quantum-Si Inc",
      symbol: "QSI",
      headline: "Delisting risk",
      eventCategory: "distress",
      items: [{ code: "3.01", label: "Delisting risk", category: "distress" }],
      summary: `Item 3.01: ${long}`,
    });
    expect(titleLine(row)).toBe(
      "Quantum-Si Inc - Delisting Risk (Stock Could Lose Its Listing)",
    );
    expect(titleTooltipLine(row)).toBe(
      "Quantum-Si Inc - Delisting Risk (Stock Could Lose Its Listing)",
    );
  });

  it("formats Item 5.02 officer changes from summary clues", () => {
    expect(
      titleLine(
        base({
          companyName: "Acme Corp",
          symbol: "ACME",
          headline: "Officer / Director Change",
          eventCategory: "management",
          items: [
            {
              code: "5.02",
              label: "Officer / Director Change",
              category: "management",
            },
          ],
          title: "Acme Corp — 8-K filing",
          summary:
            "Item 5.02: Departure of Directors or Certain Officers; Election of Directors; Appointment of Certain Officers. On July 20, 2026, Jane Smith resigned as Chief Executive Officer of the Company.",
        }),
      ),
    ).toBe("Acme Corp - CEO Change (Departure)");

    expect(
      titleLine(
        base({
          companyName: "Acme Corp",
          symbol: "ACME",
          headline: "Officer / Director Change",
          eventCategory: "management",
          items: [
            {
              code: "5.02",
              label: "Officer / Director Change",
              category: "management",
            },
          ],
          title:
            "Acme Corp — Executive Change — CEO/CFO Departure or Appointment",
          summary:
            "Item 5.02: Departure of Directors or Certain Officers. The Board appointed Robert Lee as Chief Financial Officer.",
        }),
      ),
    ).toBe("Acme Corp - CFO Change (Appointment)");

    expect(
      titleLine(
        base({
          companyName: "Acme Corp",
          symbol: "ACME",
          headline: "Officer / Director Change",
          eventCategory: "management",
          items: [
            {
              code: "5.02",
              label: "Officer / Director Change",
              category: "management",
            },
          ],
          title:
            "Acme Corp — Executive Change — CEO/CFO Departure or Appointment",
          summary:
            "Item 5.02: Departure of Directors or Certain Officers; Election of Directors; Appointment of Certain Officers; Compensatory Arrangements of Certain Officers",
        }),
      ),
    ).toBe("Acme Corp - Executive Change");
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
    ).toBe("NVIDIA Corp - New Deal Announced (Major Contract or Partnership)");
  });

  it("rewrites offering / ownership / clinical / macro / analyst titles", () => {
    expect(
      titleLine(
        base({
          type: "S-3",
          subcategory: "s3",
          eventCategory: "capital",
          headline: "Shelf registration (S-3)",
          title: "Acme Corp — S-3 filing",
          companyName: "Acme Corp",
        }),
      ),
    ).toBe("Acme Corp - Shelf Registration (S-3)");

    expect(
      titleLine(
        base({
          type: "424B5",
          subcategory: "424b",
          eventCategory: "capital",
          headline: "Prospectus / offering (424B)",
          title: "Acme Corp — 424B5 filing",
          companyName: "Acme Corp",
        }),
      ),
    ).toBe("Acme Corp - New Stock Offering Filed (Potential Dilution Ahead)");

    expect(
      titleLine(
        base({
          type: "424B2",
          subcategory: "424b",
          eventCategory: "capital",
          headline: "Structured note / pricing supplement",
          title: "C — Structured note · 8.67%",
          companyName: "Citigroup Inc",
          keyFacts: [
            { label: "Type", value: "Pricing supplement (structured note)" },
            { label: "Coupon", value: "8.67%" },
          ],
        }),
      ),
    ).toBe("C — Structured note · 8.67%");

    expect(
      titleLine(
        base({
          type: "425",
          subcategory: "425",
          eventCategory: "deals",
          headline: "Merger / Acquisition (425)",
          title: "Acme Corp — 425 filing",
          companyName: "Acme Corp",
        }),
      ),
    ).toBe("Acme Corp Announces Acquisition — Deal in Play");

    expect(
      titleLine(
        base({
          type: "425",
          subcategory: "425",
          eventCategory: "deals",
          headline: "Merger / Acquisition (425)",
          title: "Acme Corp: Merger or Acquisition News (Deal in Play)",
          companyName: "Acme Corp",
        }),
      ),
    ).toBe("Acme Corp Announces Acquisition — Deal in Play");

    expect(
      titleLine(
        base({
          type: "SC 13D",
          subcategory: "13d",
          eventCategory: "deals",
          headline: "Beneficial ownership (13D)",
          title: "Acme Corp — SC 13D filing",
          companyName: "Acme Corp",
        }),
      ),
    ).toBe("Acme Corp - Schedule 13D");

    expect(
      titleLine(
        base({
          sourceProvider: "clinicaltrials",
          type: "Clinical Trial",
          eventCategory: "clinical",
          headline: "Completed",
          title: "Pfizer Inc — Study of drug X",
          companyName: "Pfizer Inc",
        }),
      ),
    ).toBe("Pfizer Inc - Clinical Trial");

    expect(
      titleLine(
        base({
          sourceProvider: "macro-calendar",
          type: "Economics",
          eventCategory: "macro",
          subcategory: "nfp",
          headline: "Macro calendar",
          title: "NFP / Employment Situation — July 2026",
          companyName: "US Macro",
          symbol: null,
        }),
      ),
    ).toBe("Jobs Report (NFP) — July 2026");

    expect(
      titleLine(
        base({
          sourceProvider: "finnhub",
          type: "Analyst Actions",
          eventCategory: "analyst",
          subcategory: "price_target",
          headline: "Price target (Street)",
          title: "AAPL — Price target",
          companyName: "Apple Inc.",
          symbol: "AAPL",
        }),
      ),
    ).toBe("Apple Inc. - Price Target");
  });

  it("prefers ground-rule Halt / FDA / Earnings titles over generic chips", () => {
    expect(
      titleLine(
        base({
          sourceProvider: "nasdaq-halts",
          type: "Trading Halt",
          eventCategory: "trading_halt",
          headline: "Trading halt",
          title: "Halts (Steakholder Foods Ltd. ADS) — News pending",
          companyName: "Steakholder Foods Ltd. ADS",
          symbol: "STKH",
        }),
      ),
    ).toBe("Halts (Steakholder Foods Ltd. ADS) - News pending");

    expect(
      titleLine(
        base({
          sourceProvider: "openfda",
          type: "FDA Approval",
          eventCategory: "regulatory",
          subcategory: "openfda_approval",
          headline: "FDA approval update",
          title: "FDA Approval - Pfizer Inc",
          companyName: "Pfizer Inc",
        }),
      ),
    ).toBe("Pfizer Inc Receives FDA Approval!");

    expect(
      titleLine(
        base({
          sourceProvider: "finnhub",
          type: "FDA Approval",
          eventCategory: "regulatory",
          subcategory: "fda_approval",
          headline: "FDA approval update",
          title: "Pfizer Inc: FDA Approval",
          companyName: "Pfizer Inc",
        }),
      ),
    ).toBe("Pfizer Inc Receives FDA Approval!");

    expect(
      titleLine(
        base({
          sourceProvider: "finnhub",
          type: "Earnings",
          eventCategory: "earnings",
          headline: "Earnings calendar",
          title: "Earnings Report Q1 - Apple Inc.",
          companyName: "Apple Inc.",
          symbol: "AAPL",
        }),
      ),
    ).toBe("Apple Inc. - Earnings Report Q1");
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
  it("matches symbol, company name, and title case-insensitively", () => {
    const row = base({
      symbol: "TSLA",
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
