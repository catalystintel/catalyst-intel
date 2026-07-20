import { describe, expect, it } from "vitest";

import {
  formatRelativeAge,
  formatTimeDate,
  isWithinWindow,
} from "./relative-time";

describe("formatRelativeAge", () => {
  const now = Date.parse("2026-07-19T12:00:00.000Z");

  it("formats seconds and minutes for intraday scanning", () => {
    expect(formatRelativeAge("2026-07-19T11:59:40.000Z", now)).toBe("20s");
    expect(formatRelativeAge("2026-07-19T11:45:00.000Z", now)).toBe("15m");
    expect(formatRelativeAge("2026-07-19T09:00:00.000Z", now)).toBe("3h");
  });

  it("falls back to day / date for older filings", () => {
    expect(formatRelativeAge("2026-07-17T12:00:00.000Z", now)).toBe("2d");
  });
});

describe("formatTimeDate", () => {
  it("formats time · date for the feed TIME column", () => {
    // Fixed UTC instant → en-US wall clock depends on runner TZ; assert structure.
    const formatted = formatTimeDate("2026-07-20T14:23:00.000Z");
    expect(formatted).toMatch(
      /^\d{1,2}:\d{2} (AM|PM) · [A-Z][a-z]{2} \d{1,2}, 2026$/,
    );
  });
});

describe("isWithinWindow", () => {
  const now = Date.parse("2026-07-19T12:00:00.000Z");

  it("accepts all when window is null", () => {
    expect(isWithinWindow("2020-01-01T00:00:00.000Z", null, now)).toBe(true);
  });

  it("filters by hours", () => {
    expect(isWithinWindow("2026-07-19T10:00:00.000Z", 4, now)).toBe(true);
    expect(isWithinWindow("2026-07-19T06:00:00.000Z", 4, now)).toBe(false);
  });
});
