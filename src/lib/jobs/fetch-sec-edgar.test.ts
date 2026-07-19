import { describe, expect, it } from "vitest";

import {
  extractFiledDate,
  parseFilingTitle,
  stripHtml,
} from "./fetch-sec-edgar";

describe("parseFilingTitle", () => {
  it("parses a standard filer title", () => {
    expect(parseFilingTitle("8-K - PEDEVCO CORP (0001141197) (Filer)")).toEqual(
      {
        formType: "8-K",
        companyName: "PEDEVCO CORP",
        cik: 1141197,
      },
    );
  });

  it("parses a title with a dash in the company name", () => {
    expect(
      parseFilingTitle("10-Q - SOBR Safe, Inc. (0001850079) (Filed by)"),
    ).toEqual({
      formType: "10-Q",
      companyName: "SOBR Safe, Inc.",
      cik: 1850079,
    });
  });

  it("returns null for an unrecognized title format", () => {
    expect(parseFilingTitle("not a real filing title")).toBeNull();
  });
});

describe("extractFiledDate", () => {
  it("extracts a filed date from summary text", () => {
    expect(
      extractFiledDate("Acc-no: 0001234567-26-000123 (Filed: 2026-07-17)"),
    ).toBe("2026-07-17");
  });

  it("returns null when there is no filed date", () => {
    expect(extractFiledDate("no date here")).toBeNull();
  });
});

describe("stripHtml", () => {
  it("removes tags and collapses whitespace", () => {
    expect(stripHtml("<p>Hello   <b>world</b></p>")).toBe("Hello world");
  });

  it("leaves plain text unchanged", () => {
    expect(stripHtml("already plain")).toBe("already plain");
  });
});
