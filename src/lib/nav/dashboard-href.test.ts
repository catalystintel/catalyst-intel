import { describe, expect, it } from "vitest";

import { dashboardHref, parseDashboardCatalystId } from "./dashboard-href";

describe("dashboardHref", () => {
  it("returns bare dashboard with no opts", () => {
    expect(dashboardHref()).toBe("/dashboard");
    expect(dashboardHref({})).toBe("/dashboard");
  });

  it("encodes catalyst id as c", () => {
    expect(dashboardHref({ catalystId: 42 })).toBe("/dashboard?c=42");
  });

  it("encodes ticker and catalyst together", () => {
    expect(dashboardHref({ ticker: "fhb", catalystId: 7 })).toBe(
      "/dashboard?ticker=FHB&c=7",
    );
  });

  it("ignores invalid catalyst ids", () => {
    expect(dashboardHref({ catalystId: 0 })).toBe("/dashboard");
    expect(dashboardHref({ catalystId: null })).toBe("/dashboard");
  });
});

describe("parseDashboardCatalystId", () => {
  it("parses positive integer strings", () => {
    expect(parseDashboardCatalystId("12")).toBe(12);
  });

  it("rejects junk", () => {
    expect(parseDashboardCatalystId(undefined)).toBeUndefined();
    expect(parseDashboardCatalystId("")).toBeUndefined();
    expect(parseDashboardCatalystId("12x")).toBeUndefined();
    expect(parseDashboardCatalystId("0")).toBeUndefined();
  });
});
