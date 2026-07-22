import { describe, expect, it } from "vitest";

import { buildUpcomingMacroEvents } from "@/lib/jobs/fetch-macro-calendar";

describe("buildUpcomingMacroEvents", () => {
  it("returns CPI, NFP, and FOMC within the horizon", () => {
    const events = buildUpcomingMacroEvents(
      new Date("2026-07-22T12:00:00.000Z"),
      90,
    );
    const kinds = new Set(events.map((e) => e.subcategory));
    expect(kinds.has("cpi")).toBe(true);
    expect(kinds.has("nfp")).toBe(true);
    expect(kinds.has("fomc")).toBe(true);
    expect(events.every((e) => e.date >= "2026-07-22")).toBe(true);
    expect(events.find((e) => e.id === "fomc-2026-07-29")).toBeTruthy();
    expect(events.find((e) => e.id === "cpi-2026-08-12")).toBeTruthy();
  });

  it("excludes past dates", () => {
    const events = buildUpcomingMacroEvents(
      new Date("2026-12-01T12:00:00.000Z"),
      30,
    );
    expect(events.every((e) => e.date >= "2026-12-01")).toBe(true);
    expect(events.find((e) => e.id === "fomc-2026-07-29")).toBeFalsy();
  });
});
