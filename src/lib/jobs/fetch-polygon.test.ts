import { describe, expect, it } from "vitest";

import {
  PolygonHttpError,
  extractSentiment,
  isPolygonPlanTimeframeError,
  isPolygonRateLimitError,
  polygonEnrichmentSessionDate,
} from "./fetch-polygon";

describe("polygonEnrichmentSessionDate", () => {
  it("uses the event day when it is before today", () => {
    const now = new Date("2026-07-22T15:00:00.000Z");
    expect(polygonEnrichmentSessionDate("2026-07-21T18:00:00.000Z", now)).toBe(
      "2026-07-21",
    );
  });

  it("never uses today on free-tier-safe path", () => {
    const now = new Date("2026-07-22T15:00:00.000Z");
    expect(polygonEnrichmentSessionDate("2026-07-22T12:00:00.000Z", now)).toBe(
      "2026-07-21",
    );
  });

  it("rolls weekend session dates back to Friday", () => {
    const now = new Date("2026-07-22T15:00:00.000Z"); // Wednesday
    // Sunday event → Friday
    expect(polygonEnrichmentSessionDate("2026-07-19T12:00:00.000Z", now)).toBe(
      "2026-07-17",
    );
  });
});

describe("extractSentiment", () => {
  it("returns null when there are no insights", () => {
    expect(extractSentiment(undefined, "ACME")).toBeNull();
    expect(extractSentiment([], "ACME")).toBeNull();
  });

  it("prefers the insight matching the resolved ticker", () => {
    const result = extractSentiment(
      [
        { ticker: "OTHR", sentiment: "negative", sentiment_reasoning: "bad" },
        { ticker: "ACME", sentiment: "positive", sentiment_reasoning: "good" },
      ],
      "ACME",
    );
    expect(result).toEqual({ sentiment: "bullish", reasoning: "good" });
  });

  it("falls back to the first insight when no ticker match", () => {
    const result = extractSentiment(
      [{ ticker: "OTHR", sentiment: "neutral" }],
      "ACME",
    );
    expect(result).toEqual({ sentiment: "neutral", reasoning: null });
  });

  it("returns null for unrecognized sentiment strings", () => {
    expect(
      extractSentiment([{ ticker: "ACME", sentiment: "mixed" }], "ACME"),
    ).toBeNull();
  });
});

describe("Polygon error classifiers", () => {
  it("detects rate limit 429 bodies", () => {
    const err = new PolygonHttpError(
      "/v2/aggs/ticker/AAPL/range/1/day/2026-01-15/2026-01-15",
      429,
      JSON.stringify({
        status: "ERROR",
        error:
          "You've exceeded the maximum requests per minute, please wait or upgrade your subscription to continue. https://massive.com/pricing",
      }),
      "Too Many Requests",
    );
    expect(isPolygonRateLimitError(err)).toBe(true);
    expect(isPolygonPlanTimeframeError(err)).toBe(false);
  });

  it("detects plan timeframe 403 bodies", () => {
    const err = new PolygonHttpError(
      "/v2/aggs/ticker/AAPL/range/1/day/2026-07-22/2026-07-22",
      403,
      JSON.stringify({
        status: "NOT_AUTHORIZED",
        message:
          "Your plan doesn't include this data timeframe. Please upgrade your plan at https://polygon.io/pricing",
      }),
      "Forbidden",
    );
    expect(isPolygonPlanTimeframeError(err)).toBe(true);
    expect(isPolygonRateLimitError(err)).toBe(false);
  });
});
