import { describe, expect, it } from "vitest";

import {
  extractItems,
  extractSecItemBlurb,
  isSecCatalogHeadline,
  parseFilingSummary,
  selectPrimaryItem,
} from "./parse-8k-items";

const REAL_SUMMARY =
  "Filed: 2026-07-17 AccNo: 0001654954-26-006724 Size: 191 KB " +
  "Item 5.02: Departure of Directors or Certain Officers; Election of Directors; " +
  "Appointment of Certain Officers: Compensatory Arrangements of Certain Officers " +
  "Item 9.01: Financial Statements and Exhibits";

describe("extractItems", () => {
  it("extracts item codes in order and maps them to trader labels", () => {
    const items = extractItems(REAL_SUMMARY);
    expect(items).toEqual([
      {
        code: "5.02",
        label: "Officer / Director Change",
        category: "management",
      },
      { code: "9.01", label: "Exhibits", category: "other" },
    ]);
  });

  it("de-duplicates repeated item codes", () => {
    const items = extractItems(
      "Item 8.01: Other Events Item 8.01: Other Events",
    );
    expect(items).toHaveLength(1);
    expect(items[0].code).toBe("8.01");
  });

  it("labels unknown codes generically without throwing", () => {
    const items = extractItems("Item 99.99: Something new");
    expect(items).toEqual([
      { code: "99.99", label: "Item 99.99", category: "other" },
    ]);
  });

  it("returns an empty array when no item codes are present", () => {
    expect(extractItems("Filed: 2026-07-17 AccNo: 123 Size: 10 KB")).toEqual(
      [],
    );
  });
});

describe("extractSecItemBlurb", () => {
  it("returns the official description for a primary item", () => {
    const blurb = extractSecItemBlurb(REAL_SUMMARY, "5.02");
    expect(blurb).toMatch(/^Departure of Directors/);
    expect(blurb).not.toMatch(/Item 9\.01/);
    expect(blurb!.length).toBeLessThanOrEqual(110);
  });

  it("falls back to the first item when code omitted", () => {
    expect(extractSecItemBlurb(REAL_SUMMARY)).toMatch(
      /^Departure of Directors/,
    );
  });
});

describe("isSecCatalogHeadline", () => {
  it("detects short catalog labels", () => {
    expect(isSecCatalogHeadline("Earnings / Results")).toBe(true);
    expect(isSecCatalogHeadline("Officer / Director Change")).toBe(true);
    expect(isSecCatalogHeadline("Officer / director change")).toBe(true);
    expect(isSecCatalogHeadline("Liberty Global reports Q2 results")).toBe(
      false,
    );
  });
});

describe("selectPrimaryItem", () => {
  it("prefers the market-moving item over boilerplate exhibits", () => {
    const items = extractItems(REAL_SUMMARY);
    expect(selectPrimaryItem(items)?.code).toBe("5.02");
  });

  it("ranks distress above disclosure when several items co-occur", () => {
    const items = extractItems(
      "Item 7.01: Regulation FD Disclosure Item 1.03: Bankruptcy or Receivership",
    );
    expect(selectPrimaryItem(items)?.category).toBe("distress");
  });

  it("falls back to exhibits only when it is the sole item", () => {
    const items = extractItems("Item 9.01: Financial Statements and Exhibits");
    expect(selectPrimaryItem(items)?.code).toBe("9.01");
  });

  it("returns null for an empty item list", () => {
    expect(selectPrimaryItem([])).toBeNull();
  });
});

describe("parseFilingSummary", () => {
  it("headlines the most material item of a real multi-item filing", () => {
    const parsed = parseFilingSummary(REAL_SUMMARY);
    expect(parsed.headline).toBe("Officer / Director Change");
    expect(parsed.primaryCategory).toBe("management");
    expect(parsed.items).toHaveLength(2);
  });

  it("falls back to a generic filing when nothing parses", () => {
    const parsed = parseFilingSummary("no items here");
    expect(parsed).toEqual({
      items: [],
      primaryCategory: "other",
      headline: "Current report",
    });
  });
});
