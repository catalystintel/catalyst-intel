import { describe, expect, it } from "vitest";

import { classifySecFormType } from "./parse-8k-items";
import {
  parseHaltRssItem,
  parseHaltTitle,
  xmlText,
} from "./fetch-nasdaq-halts";

describe("parseHaltTitle", () => {
  it("detects a trading halt", () => {
    expect(parseHaltTitle("XYZ Trading Halt")).toEqual({
      symbol: "XYZ",
      headline: "Trading halt",
      subcategory: "halt",
    });
  });

  it("detects halt resumed", () => {
    expect(parseHaltTitle("ABCD Halt Resumed")).toEqual({
      symbol: "ABCD",
      headline: "Halt resumed",
      subcategory: "halt_resumed",
    });
  });
});

describe("parseHaltRssItem", () => {
  it("builds Halts (Company): reason from ndaq fields", () => {
    const parsed = parseHaltRssItem({
      title: "STKH",
      "ndaq:IssueSymbol": "STKH",
      "ndaq:IssueName": "Steakholder Foods Ltd. ADS",
      "ndaq:ReasonCode": "T1",
      "ndaq:Market": "NASDAQ",
      "ndaq:HaltDate": "07/24/2026",
      "ndaq:HaltTime": "19:50:00.000",
    });

    expect(parsed).toMatchObject({
      symbol: "STKH",
      issueName: "Steakholder Foods Ltd. ADS",
      reasonCode: "T1",
      reasonLabel: "News pending",
      subcategory: "halt",
      companyName: "Steakholder Foods Ltd. ADS",
      title: "Halts (Steakholder Foods Ltd. ADS): News pending",
      headline: "Halts (Steakholder Foods Ltd. ADS): News pending",
    });
  });

  it("falls back to symbol when IssueName is missing", () => {
    const parsed = parseHaltRssItem({
      title: "PMI",
      "ndaq:IssueSymbol": "PMI",
      "ndaq:ReasonCode": "H11",
    });
    expect(parsed?.title).toBe("Halts (PMI): Regulatory concern");
    expect(parsed?.companyName).toBe("PMI");
  });

  it("marks resume codes as halt_resumed", () => {
    const parsed = parseHaltRssItem({
      title: "ACME",
      "ndaq:IssueSymbol": "ACME",
      "ndaq:IssueName": "Acme Corp",
      "ndaq:ReasonCode": "T3",
      "ndaq:ResumptionTradeTime": "10:05:00",
    });
    expect(parsed?.subcategory).toBe("halt_resumed");
    expect(parsed?.title).toContain("News disseminated");
  });

  it("reads unprefixed parser keys as well", () => {
    const parsed = parseHaltRssItem({
      title: "XYZ",
      IssueSymbol: "XYZ",
      IssueName: "XYZ Holdings",
      ReasonCode: "LUDP",
    });
    expect(parsed?.title).toBe(
      "Halts (XYZ Holdings): Volatility trading pause (LULD)",
    );
  });
});

describe("xmlText", () => {
  it("extracts strings and #text nodes", () => {
    expect(xmlText("T1")).toBe("T1");
    expect(xmlText({ "#text": "NASDAQ" })).toBe("NASDAQ");
    expect(xmlText("")).toBeNull();
    expect(xmlText(null)).toBeNull();
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

  it("maps Form 425 to deals", () => {
    expect(classifySecFormType("425")).toMatchObject({
      category: "deals",
      subcategory: "425",
      headline: "Merger / Acquisition (425)",
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
