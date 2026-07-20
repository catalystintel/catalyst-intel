import { describe, expect, it } from "vitest";

import { parseOpenFdaDate } from "./fetch-openfda";

describe("parseOpenFdaDate", () => {
  it("parses YYYYMMDD from openFDA", () => {
    expect(parseOpenFdaDate("20241023")).toBe("2024-10-23");
    expect(parseOpenFdaDate("20020802")).toBe("2002-08-02");
  });

  it("accepts already-ISO dates", () => {
    expect(parseOpenFdaDate("2024-10-23")).toBe("2024-10-23");
    expect(parseOpenFdaDate("2024-10-23T12:00:00Z")).toBe("2024-10-23");
  });

  it("returns null for empty or invalid values", () => {
    expect(parseOpenFdaDate(null)).toBeNull();
    expect(parseOpenFdaDate("")).toBeNull();
    expect(parseOpenFdaDate("not-a-date")).toBeNull();
  });
});
