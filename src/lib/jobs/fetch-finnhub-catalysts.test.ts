import { describe, expect, it } from "vitest";

import {
  priceTargetToNormalized,
  recommendationToNormalized,
} from "./fetch-finnhub-catalysts";

describe("recommendationToNormalized", () => {
  it("maps Finnhub consensus into Analyst Actions", () => {
    const item = recommendationToNormalized("NVDA", {
      period: "2026-07-01",
      strongBuy: 20,
      buy: 15,
      hold: 5,
      sell: 1,
      strongSell: 0,
    });
    expect(item).toMatchObject({
      provider: "finnhub",
      ticker: "NVDA",
      eventCategory: "analyst",
      subcategory: "recommendation_trend",
      type: "Analyst Actions",
    });
    expect(item?.summary).toMatch(/Bullish skew/);
    expect(item?.externalId).toBe("finnhub:rec:NVDA:2026-07-01");
  });
});

describe("priceTargetToNormalized", () => {
  it("maps Street PT into Analyst Actions", () => {
    const item = priceTargetToNormalized("AAPL", {
      lastUpdated: "2026-07-20",
      targetMean: 240,
      targetMedian: 235,
      targetHigh: 300,
      targetLow: 180,
    });
    expect(item).toMatchObject({
      eventCategory: "analyst",
      subcategory: "price_target",
      type: "Analyst Actions",
    });
    expect(item?.summary).toContain("Mean $240");
  });

  it("returns null without targets", () => {
    expect(
      priceTargetToNormalized("AAPL", { lastUpdated: "2026-07-20" }),
    ).toBeNull();
  });
});
