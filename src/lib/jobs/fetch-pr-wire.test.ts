import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  articleToNormalized,
  buildPublicReceiptSummary,
  mapPublicDirection,
  mapPublicEventCategory,
  opaquePrWireId,
  prWireArticleId,
  prWirePublisherLabel,
  publicReceiptHistoricalImpact,
  publicReceiptToArticle,
} from "./fetch-pr-wire";
import { containsBlockedWireTrace } from "./sanitize-pr-wire";

describe("opaquePrWireId / prWireArticleId", () => {
  it("hashes explicit ids (no raw upstream id persisted)", () => {
    const id = prWireArticleId({
      id: "lseg_n123",
      article_url: "https://example.invalid/a/x",
    });
    expect(id).toBe(opaquePrWireId("lseg_n123"));
    expect(id).toBe(
      createHash("sha256").update("lseg_n123").digest("hex").slice(0, 24),
    );
  });
});

describe("publicReceiptToArticle / category map", () => {
  it("maps a public receipt into a wire article with impact + sentiment", () => {
    const article = publicReceiptToArticle({
      ticker: "STKH",
      score: 95,
      direction: "bearish",
      event_type: "financing_offering",
      event_label: "financing / offering",
      scored_at: "2026-07-31T12:47:15.758398+00:00",
      title: "Steakholder Foods Ltd. Announces Private Placement",
      theme: "biotech_catalyst",
      realized_move_pct: -12.5,
      realized_max_abs: 12.5,
      settled: true,
    });
    expect(article).toMatchObject({
      ticker: "STKH",
      impactScore: 95,
      sentiment: "bearish",
      eventType: "financing_offering",
      theme: "biotech_catalyst",
      realizedMovePct: -12.5,
      settled: true,
    });
    expect(article?.article_body).toContain("Session move -12.50%");
    expect(article?.article_body).not.toMatch(/Impact score/i);
    expect(article?.extracted?.keyFacts?.some((f) => f.label === "Event")).toBe(
      true,
    );
    expect(
      article?.extracted?.keyFacts?.some((f) =>
        /impact\s*score/i.test(f.label),
      ),
    ).toBe(false);
    expect(
      article?.extracted?.keyFacts?.some((f) => /^tier$/i.test(f.label)),
    ).toBe(false);
    const normalized = articleToNormalized(article!);
    expect(normalized).toMatchObject({
      provider: "pr-wire",
      symbol: "STKH",
      impactScore: 95,
      sentiment: "bearish",
      eventCategory: "capital",
      subcategory: "financing_offering",
      url: null,
      type: "Press Release",
      headline: "financing / offering",
      confidence: 88,
    });
    expect(normalized?.historicalImpact).toMatchObject({
      status: "settled",
      pctChange: -12.5,
      maxAbs: 12.5,
    });
    expect(
      (normalized?.historicalImpact as Record<string, unknown> | null)
        ?.provider,
    ).toBeUndefined();
    expect(normalized?.rawContent).toMatchObject({
      extracted: {
        keyFacts: expect.any(Array),
      },
    });
    expect(normalized?.rawContent).not.toHaveProperty("publisherName");
    expect(normalized?.rawContent).not.toHaveProperty("wireSource");
    expect(normalized?.rawContent).not.toHaveProperty("impactScore");
    expect(normalized?.rawContent).not.toHaveProperty("tier");
    expect(normalized?.tags).toContain("biotech_catalyst");
    expect(normalized?.tags).not.toContain("wire");
    expect(containsBlockedWireTrace(JSON.stringify(normalized))).toBe(false);
  });

  it("maps known event types from the public board sample", () => {
    expect(mapPublicEventCategory("contract_award", "x").eventCategory).toBe(
      "deals",
    );
    expect(
      mapPublicEventCategory("clinical_trial_results", "x").eventCategory,
    ).toBe("clinical");
    expect(mapPublicEventCategory("earnings_beat", "x").eventCategory).toBe(
      "earnings",
    );
    expect(mapPublicEventCategory("regulatory_action", "x").eventCategory).toBe(
      "regulatory",
    );
    expect(mapPublicDirection("bullish")).toBe("bullish");
  });

  it("leaves historicalImpact empty until the board settles a move", () => {
    const article = publicReceiptToArticle({
      ticker: "KPTI",
      score: 72,
      direction: "bullish",
      event_type: "clinical_trial_results",
      event_label: "clinical trial results",
      scored_at: "2026-07-30T20:06:40.861186+00:00",
      title: "Karyopharm Plans to Submit sNDA",
      theme: "biotech_catalyst",
      realized_move_pct: null,
      settled: false,
    });
    expect(publicReceiptHistoricalImpact(article!)).toBeNull();
    expect(articleToNormalized(article!)?.historicalImpact ?? null).toBeNull();
    expect(buildPublicReceiptSummary(article!)).toContain(
      "Session move pending",
    );
    expect(buildPublicReceiptSummary(article!)).toContain("Karyopharm");
  });
});

describe("prWirePublisherLabel", () => {
  it("never returns a wire-house or product source byline", () => {
    expect(prWirePublisherLabel("Business Wire")).toBeNull();
    expect(prWirePublisherLabel(null)).toBeNull();
  });
});
