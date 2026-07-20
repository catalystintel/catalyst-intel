import { describe, expect, it } from "vitest";

import { classifySession, sessionMatches } from "./session";

describe("classifySession", () => {
  it("labels pre-market, RTH, and after-hours in ET", () => {
    // 2026-07-20 08:00 UTC = 04:00 ET (EDT)
    expect(classifySession("2026-07-20T08:00:00.000Z")).toBe("PM");
    // 14:00 UTC = 10:00 ET
    expect(classifySession("2026-07-20T14:00:00.000Z")).toBe("RTH");
    // 21:00 UTC = 17:00 ET
    expect(classifySession("2026-07-20T21:00:00.000Z")).toBe("AH");
  });
});

describe("sessionMatches", () => {
  it("allows any when filter empty or includes any", () => {
    expect(sessionMatches("AH", undefined)).toBe(true);
    expect(sessionMatches("AH", ["any"])).toBe(true);
  });

  it("requires listed sessions otherwise", () => {
    expect(sessionMatches("AH", ["AH", "PM"])).toBe(true);
    expect(sessionMatches("RTH", ["AH", "PM"])).toBe(false);
  });
});
