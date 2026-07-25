import { describe, expect, it } from "vitest";

import {
  createShareToken,
  defaultReportTitle,
  normalizeReportItems,
  sinceIsoForReportWindow,
} from "./build-snapshot";

describe("sinceIsoForReportWindow", () => {
  const NOW = new Date("2024-06-15T12:00:00Z").getTime();

  it("returns 24h ago for 24h window", () => {
    const since = sinceIsoForReportWindow("24h", NOW);
    expect(since).toBe(new Date(NOW - 24 * 60 * 60_000).toISOString());
  });

  it("returns 7d ago for 7d window", () => {
    const since = sinceIsoForReportWindow("7d", NOW);
    expect(since).toBe(new Date(NOW - 7 * 24 * 60 * 60_000).toISOString());
  });

  it("returns 30d ago for 30d window", () => {
    const since = sinceIsoForReportWindow("30d", NOW);
    expect(since).toBe(new Date(NOW - 30 * 24 * 60 * 60_000).toISOString());
  });
});

describe("defaultReportTitle", () => {
  const NOW = new Date("2024-06-15T12:00:00Z").getTime();

  it("formats watchlist title", () => {
    const title = defaultReportTitle("24h", "watchlist", NOW);
    expect(title).toContain("Watchlist");
    expect(title).toContain("24h");
    expect(title).toContain("2024");
  });

  it("formats all-catalysts title", () => {
    const title = defaultReportTitle("7d", "all", NOW);
    expect(title).toContain("All catalysts");
    expect(title).toContain("7d");
  });
});

describe("createShareToken", () => {
  it("returns a URL-safe base64 string of ~22 chars", () => {
    const token = createShareToken();
    expect(token).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(token.length).toBeGreaterThanOrEqual(20);
    expect(token).not.toContain("+");
    expect(token).not.toContain("/");
    expect(token).not.toContain("=");
  });

  it("returns unique tokens", () => {
    const a = createShareToken();
    const b = createShareToken();
    expect(a).not.toBe(b);
  });
});

describe("normalizeReportItems", () => {
  it("maps rows to typed items", () => {
    const rows = [
      {
        id: 1,
        symbol: "AAPL",
        title: "Apple reports earnings",
        eventCategory: "earnings",
        impactScore: 80,
        timestamp: "2024-06-15T12:00:00Z",
        sourceProvider: "benzinga",
        type: "article",
      },
    ];
    const items = normalizeReportItems(rows);
    expect(items).toHaveLength(1);
    expect(items[0]?.symbol).toBe("AAPL");
    expect(items[0]?.eventCategory).toBe("earnings");
  });

  it("nulls invalid eventCategory", () => {
    const rows = [
      {
        id: 2,
        symbol: null,
        title: "Some news",
        eventCategory: "not_a_real_category",
        impactScore: null,
        timestamp: "2024-06-15T12:00:00Z",
        sourceProvider: null,
        type: "article",
      },
    ];
    const items = normalizeReportItems(rows);
    expect(items[0]?.eventCategory).toBeNull();
  });

  it("slices to REPORT_MAX_ITEMS", () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      symbol: null,
      title: `headline ${i}`,
      eventCategory: null,
      impactScore: null,
      timestamp: "2024-06-15T12:00:00Z",
      sourceProvider: null,
      type: "article",
    }));
    const items = normalizeReportItems(rows);
    expect(items).toHaveLength(80);
  });
});
