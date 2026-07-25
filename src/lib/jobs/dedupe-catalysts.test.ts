import { describe, expect, it } from "vitest";

import {
  areNearDuplicateTitles,
  contentFingerprint,
  normalizeDedupeTitle,
  pickClusterPrimary,
  providerPreference,
  shouldSkipAsDuplicate,
  titleSimilarity,
} from "./dedupe-catalysts";

describe("normalizeDedupeTitle / titleSimilarity", () => {
  it("normalizes chrome and matches the same story across sources", () => {
    const a = normalizeDedupeTitle(
      "Apple Inc. Announces Record Quarterly Results — Reuters",
    );
    const b = normalizeDedupeTitle(
      "Apple Inc announces record quarterly results (Benzinga)",
    );
    expect(a).toContain("apple");
    expect(titleSimilarity(a, b)).toBeGreaterThanOrEqual(0.72);
    expect(areNearDuplicateTitles(a, b)).toBe(true);
  });

  it("does not match unrelated titles", () => {
    expect(
      areNearDuplicateTitles(
        "Form 4 Insider Buy - Apple Inc.",
        "Earnings Report Q2 - Apple Inc.",
      ),
    ).toBe(false);
  });
});

describe("contentFingerprint", () => {
  it("keys symbol + normalized title", () => {
    expect(contentFingerprint("aapl", "Earnings Report Q2 - Apple Inc.")).toBe(
      "AAPL|earnings report q2 apple inc",
    );
  });

  it("returns null without symbol or title", () => {
    expect(contentFingerprint(null, "hello")).toBeNull();
    expect(contentFingerprint("AAPL", "")).toBeNull();
  });
});

describe("providerPreference / pickClusterPrimary", () => {
  it("ranks SEC above Polygon", () => {
    expect(providerPreference("sec-edgar")).toBeGreaterThan(
      providerPreference("polygon"),
    );
  });

  it("prefers higher impact, then better provider", () => {
    const primary = pickClusterPrimary([
      { id: 1, impactScore: 60, provider: "polygon" },
      { id: 2, impactScore: 60, provider: "sec-edgar" },
      { id: 3, impactScore: 50, provider: "finnhub" },
    ]);
    expect(primary.id).toBe(2);
  });
});

describe("shouldSkipAsDuplicate", () => {
  const existing = [
    {
      id: 10,
      title: "Acme Corp announces material agreement",
      headline: "Material agreement",
      provider: "sec-edgar",
      eventCategory: "deals",
      timestamp: "2026-07-25T12:00:00.000Z",
      impactScore: 80,
    },
  ];

  it("skips a weaker wire retelling", () => {
    const verdict = shouldSkipAsDuplicate(
      {
        symbol: "ACME",
        title: "Acme Corp Announces Material Agreement — Benzinga",
        headline: "Acme Corp announces material agreement",
        provider: "polygon",
        eventCategory: "deals",
        timestamp: "2026-07-25T12:05:00.000Z",
      },
      existing,
      { nowMs: Date.parse("2026-07-25T12:10:00.000Z") },
    );
    expect(verdict.skip).toBe(true);
    expect(verdict.matchedId).toBe(10);
  });

  it("allows a better-source arrival after a wire", () => {
    const verdict = shouldSkipAsDuplicate(
      {
        symbol: "ACME",
        title: "Material Agreement - Acme Corp",
        headline: "Material agreement",
        provider: "sec-edgar",
        eventCategory: "deals",
        timestamp: "2026-07-25T12:08:00.000Z",
      },
      [
        {
          id: 11,
          title: "Acme Corp announces material agreement",
          headline: "Acme material agreement",
          provider: "polygon",
          eventCategory: "deals",
          timestamp: "2026-07-25T12:00:00.000Z",
        },
      ],
      { nowMs: Date.parse("2026-07-25T12:10:00.000Z") },
    );
    expect(verdict.skip).toBe(false);
  });

  it("does not skip unrelated same-symbol events", () => {
    const verdict = shouldSkipAsDuplicate(
      {
        symbol: "ACME",
        title: "Form 4 Insider Buy - Acme Corp",
        headline: "Insider buy (Form 4)",
        provider: "sec-edgar",
        eventCategory: "insider",
        timestamp: "2026-07-25T12:05:00.000Z",
      },
      existing,
      { nowMs: Date.parse("2026-07-25T12:10:00.000Z") },
    );
    expect(verdict.skip).toBe(false);
  });
});
