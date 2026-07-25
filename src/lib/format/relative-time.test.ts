import { describe, expect, it } from "vitest";

import {
  formatEventTime,
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

describe("formatTimeDate / formatEventTime", () => {
  it("formats event occurrence in the given local zone (not DB insert time)", () => {
    // 14:23 UTC on Jul 20 = 10:23 AM EDT
    expect(
      formatTimeDate("2026-07-20T14:23:00.000Z", {
        timeZone: "America/New_York",
      }),
    ).toBe("10:23 AM EDT · Jul 20, 2026");
    expect(
      formatEventTime("2026-07-20T14:23:00.000Z", {
        timeZone: "America/New_York",
      }),
    ).toBe("10:23 AM EDT · Jul 20, 2026");
  });

  it("formats in Asia/Jerusalem when asked", () => {
    // 21:31 UTC Jul 24 = 00:31 IDT Jul 25 (UTC+3 in July)
    expect(
      formatEventTime("2026-07-24T21:31:02.000Z", {
        timeZone: "Asia/Jerusalem",
      }),
    ).toBe("12:31 AM GMT+3 · Jul 25, 2026");
  });

  it("returns em dash for invalid ISO", () => {
    expect(formatEventTime("not-a-date")).toBe("—");
  });
});

describe("isWithinWindow", () => {
  const now = Date.parse("2026-07-19T12:00:00.000Z");

  it("accepts all when window is null", () => {
    expect(isWithinWindow("2020-01-01T00:00:00.000Z", null, now)).toBe(true);
  });

  it("filters by minutes", () => {
    // 4h = 240 minutes
    expect(isWithinWindow("2026-07-19T10:00:00.000Z", 240, now)).toBe(true);
    expect(isWithinWindow("2026-07-19T06:00:00.000Z", 240, now)).toBe(false);
  });

  it("supports Recent-length windows (30m)", () => {
    expect(isWithinWindow("2026-07-19T11:45:00.000Z", 30, now)).toBe(true);
    expect(isWithinWindow("2026-07-19T11:20:00.000Z", 30, now)).toBe(false);
  });

  it("rejects future timestamps even with an unbounded (All) window", () => {
    // Regression: a negative `now - then` used to satisfy `<= windowMinutes`
    // for *any* window, so a scheduled-future calendar event (e.g. a Nov
    // 2026 FOMC date) looked "within" every lookback window, including
    // Recent, while sitting in Jul 2026.
    expect(isWithinWindow("2026-11-06T12:00:00.000Z", null, now)).toBe(false);
    expect(isWithinWindow("2026-07-19T12:00:01.000Z", 30, now)).toBe(false);
  });
});
