import { describe, expect, it } from "vitest";

import { parsePortfolioSymbols } from "./parse-portfolio-symbols";

describe("parsePortfolioSymbols", () => {
  it("parses newline and comma lists", () => {
    expect(parsePortfolioSymbols("AAPL\nMSFT, NVDA").symbols).toEqual([
      "AAPL",
      "MSFT",
      "NVDA",
    ]);
  });

  it("skips headers and invalid tokens", () => {
    const { symbols, skipped } = parsePortfolioSymbols(
      "Symbol,Name\nAAPL,Apple Inc\n!!!\nGOOGL",
    );
    expect(symbols).toEqual(["AAPL", "GOOGL"]);
    expect(skipped).toBeGreaterThan(0);
  });

  it("dedupes and respects max", () => {
    const { symbols } = parsePortfolioSymbols("AAA\nAAA\nBBB\nCCC", 2);
    expect(symbols).toEqual(["AAA", "BBB"]);
  });
});
