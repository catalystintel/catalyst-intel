import { describe, expect, it } from "vitest";

import { parseHaltTitle } from "./fetch-nasdaq-halts";
import { classifySecFormType } from "./parse-8k-items";

describe("parseHaltTitle", () => {
  it("detects a trading halt", () => {
    expect(parseHaltTitle("XYZ Trading Halt")).toEqual({
      ticker: "XYZ",
      headline: "Trading halt",
      subcategory: "halt",
    });
  });

  it("detects halt resumed", () => {
    expect(parseHaltTitle("ABCD Halt Resumed")).toEqual({
      ticker: "ABCD",
      headline: "Halt resumed",
      subcategory: "halt_resumed",
    });
  });
});

describe("classifySecFormType", () => {
  it("maps Form 4 to insider", () => {
    expect(classifySecFormType("4")).toMatchObject({
      category: "insider",
      subcategory: "form4",
    });
  });

  it("maps S-3 and 424B to capital", () => {
    expect(classifySecFormType("S-3")).toMatchObject({
      category: "capital",
      subcategory: "s3",
    });
    expect(classifySecFormType("424B5")).toMatchObject({
      category: "capital",
      subcategory: "424b",
    });
  });

  it("maps 13D/G ownership forms", () => {
    expect(classifySecFormType("SC 13D")).toMatchObject({
      category: "deals",
      subcategory: "13d",
    });
    expect(classifySecFormType("SC 13G/A")).toMatchObject({
      category: "governance",
      subcategory: "13g",
    });
  });
});
