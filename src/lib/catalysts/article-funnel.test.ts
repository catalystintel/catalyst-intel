import { describe, expect, it } from "vitest";

import {
  deriveTakeaways,
  deriveWhyMoving,
  extractArticleThumbUrl,
  extractRelatedSymbols,
  parseDeltaSincePublish,
  segmentBeatMissWords,
  segmentCatalystHighlights,
} from "./article-funnel";

describe("deriveWhyMoving", () => {
  it("prefers earnings intro", () => {
    const why = deriveWhyMoving({
      summary: "Longer summary that is secondary.",
      detailCards: [
        {
          id: "earnings-results",
          kind: "earnings",
          title: "Earnings results",
          intro: "NVDA reported earnings: EPS beat (+12% surprise).",
          fields: [],
        },
      ],
    });
    expect(why).toContain("EPS beat");
  });

  it("falls back to summary first sentence", () => {
    const why = deriveWhyMoving({
      summary:
        "Acme raised full-year guidance after a strong quarter. Analysts remain mixed.",
    });
    expect(why).toContain("raised full-year guidance");
    expect(why).not.toContain("Analysts remain mixed");
  });

  it("appends session delta when present (WIIM-lite)", () => {
    const why = deriveWhyMoving({
      summary: "Acme raised full-year guidance after a strong quarter.",
      delta: { pctChange: -2.4, date: "2026-07-21" },
    });
    expect(why).toContain("raised full-year guidance");
    expect(why).toMatch(/Session -2\.4%/);
    expect(why).toContain("2026-07-21");
  });
});

describe("deriveTakeaways", () => {
  it("returns up to three sentence bullets", () => {
    const bullets = deriveTakeaways(
      "Alpha beat EPS. Revenue also beat. Guidance was raised. Extra ignored.",
    );
    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toContain("Alpha beat EPS");
    expect(bullets[2]).toContain("Guidance was raised");
  });
});

describe("extractRelatedSymbols", () => {
  it("reads polygon symbols excluding primary", () => {
    expect(
      extractRelatedSymbols({ symbols: ["NVDA", "AVGO", "TSM"] }, "NVDA", [
        "amd",
        "news",
      ]),
    ).toEqual(["AVGO", "TSM", "AMD"]);
  });
});

describe("extractArticleThumbUrl", () => {
  it("returns https image_url when present", () => {
    expect(
      extractArticleThumbUrl({
        image_url: "https://cdn.example.com/n.jpg",
      }),
    ).toBe("https://cdn.example.com/n.jpg");
  });

  it("returns null when missing", () => {
    expect(extractArticleThumbUrl({ title: "No image" })).toBeNull();
  });
});

describe("parseDeltaSincePublish", () => {
  it("reads pctChange soft-fail otherwise", () => {
    expect(
      parseDeltaSincePublish({ pctChange: 2.4, date: "2026-07-21" }),
    ).toEqual({
      pctChange: 2.4,
      date: "2026-07-21",
    });
    expect(parseDeltaSincePublish({ status: "no_bar" })).toBeNull();
    expect(parseDeltaSincePublish(null)).toBeNull();
  });
});

describe("segmentCatalystHighlights", () => {
  it("accents beat/miss words only", () => {
    const segs = segmentCatalystHighlights(
      "Company Beats EPS but Misses revenue.",
    );
    const accents = segs.filter((s) => s.type === "accent");
    expect(accents.map((a) => a.value)).toEqual(["Beats", "Misses"]);
    expect(accents[0]?.tone).toBe("positive");
    expect(accents[1]?.tone).toBe("negative");
  });
});

describe("segmentBeatMissWords", () => {
  it("highlights Beat label", () => {
    const segs = segmentBeatMissWords("Beat");
    expect(segs).toEqual([{ type: "accent", value: "Beat", tone: "positive" }]);
  });
});
