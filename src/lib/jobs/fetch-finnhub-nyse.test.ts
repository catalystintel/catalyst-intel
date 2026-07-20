import { describe, expect, it } from "vitest";

import { NYSE_MIC } from "./fetch-finnhub-nyse";
import { isFinnhubConfigured } from "./finnhub-env";

describe("finnhub-env", () => {
  it("reports unconfigured when FINNHUB_API_KEY is empty", () => {
    const prev = process.env.FINNHUB_API_KEY;
    delete process.env.FINNHUB_API_KEY;
    expect(isFinnhubConfigured()).toBe(false);
    process.env.FINNHUB_API_KEY = prev;
  });
});

describe("NYSE_MIC", () => {
  it("uses XNYS as the NYSE primary MIC", () => {
    expect(NYSE_MIC).toBe("XNYS");
  });
});
