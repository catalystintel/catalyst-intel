import { describe, expect, it } from "vitest";

import { formBucketFromType } from "./feed-form-filters";
import {
  encodeFeedCursor,
  parseFeedCursor,
  parseFeedQueryFromSearchParams,
  sectorSqlValues,
} from "./feed-query";

describe("formBucketFromType", () => {
  it("buckets common SEC forms", () => {
    expect(formBucketFromType("8-K")).toBe("8-K");
    expect(formBucketFromType("8-K/A")).toBe("8-K");
    expect(formBucketFromType("424B5")).toBe("424B");
    expect(formBucketFromType("4")).toBe("4");
    expect(formBucketFromType("S-3")).toBe("S-3");
    expect(formBucketFromType("SC 13D")).toBe("13D");
    expect(formBucketFromType("news")).toBe("other");
  });
});

describe("feed cursor", () => {
  it("round-trips", () => {
    const encoded = encodeFeedCursor({
      timestamp: "2026-07-24T12:00:00.000Z",
      id: 42,
    });
    expect(parseFeedCursor(encoded)).toEqual({
      timestamp: "2026-07-24T12:00:00.000Z",
      id: 42,
    });
  });

  it("rejects junk", () => {
    expect(parseFeedCursor(null)).toBeNull();
    expect(parseFeedCursor("nope")).toBeNull();
  });
});

describe("parseFeedQueryFromSearchParams", () => {
  it("parses multi filters and q", () => {
    const params = new URLSearchParams({
      q: "NVDA",
      categories: "earnings,capital",
      sectors: "information_technology,financials",
      forms: "8-K,424B",
      sources: "sec-edgar",
      window: "24h",
      symbolOnly: "1",
    });
    const filters = parseFeedQueryFromSearchParams(params, {
      nowIso: "2026-07-24T20:00:00.000Z",
    });
    expect(filters.q).toBe("NVDA");
    expect(filters.categories).toEqual(["earnings", "capital"]);
    expect(filters.sectors).toEqual(["information_technology", "financials"]);
    expect(filters.forms).toEqual(["8-K", "424B"]);
    expect(filters.sources).toEqual(["sec-edgar"]);
    expect(filters.timeWindow).toBe("24h");
    expect(filters.symbolOnly).toBe(true);
    expect(filters.earningsSurprisesOnly).toBe(false);
    expect(filters.since).toBeTruthy();
  });

  it("parses earningsSurprises flag", () => {
    const filters = parseFeedQueryFromSearchParams(
      new URLSearchParams({ earningsSurprises: "1" }),
      { nowIso: "2026-07-24T20:00:00.000Z" },
    );
    expect(filters.earningsSurprisesOnly).toBe(true);
  });

  it("defaults symbolOnly on when param absent", () => {
    const filters = parseFeedQueryFromSearchParams(new URLSearchParams(), {
      nowIso: "2026-07-24T20:00:00.000Z",
    });
    expect(filters.symbolOnly).toBe(true);
    expect(filters.earningsSurprisesOnly).toBe(false);
  });

  it("still parses symbolOnly false (gate remains always-on in SQL)", () => {
    const filters = parseFeedQueryFromSearchParams(
      new URLSearchParams({ symbolOnly: "0" }),
      { nowIso: "2026-07-24T20:00:00.000Z" },
    );
    expect(filters.symbolOnly).toBe(false);
  });
});

describe("sectorSqlValues", () => {
  it("includes canonical label and Finnhub aliases", () => {
    const values = sectorSqlValues(["information_technology"]);
    expect(values).toContain("Information Technology");
    expect(values).toContain("Technology");
  });
});
