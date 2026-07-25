import { describe, expect, it } from "vitest";

import { classifyFeedEmpty } from "./feed-empty-state";

describe("classifyFeedEmpty", () => {
  it("returns none while loading or when rows are visible", () => {
    expect(
      classifyFeedEmpty({
        catalystCount: 0,
        visibleCount: 0,
        loading: true,
        filtersDefault: true,
        quietMode: false,
        timeWindow: "all",
      }),
    ).toBe("none");
    expect(
      classifyFeedEmpty({
        catalystCount: 3,
        visibleCount: 2,
        loading: false,
        filtersDefault: true,
        quietMode: false,
        timeWindow: "all",
      }),
    ).toBe("none");
  });

  it("returns db only when unfiltered and empty", () => {
    expect(
      classifyFeedEmpty({
        catalystCount: 0,
        visibleCount: 0,
        loading: false,
        filtersDefault: true,
        quietMode: false,
        timeWindow: "all",
      }),
    ).toBe("db");
  });

  it("treats empty 4h poll as time_window, not empty db", () => {
    expect(
      classifyFeedEmpty({
        catalystCount: 0,
        visibleCount: 0,
        loading: false,
        filtersDefault: false,
        quietMode: false,
        timeWindow: "4h",
      }),
    ).toBe("time_window");
  });

  it("prefers quiet messaging when quiet mode hides rows", () => {
    expect(
      classifyFeedEmpty({
        catalystCount: 5,
        visibleCount: 0,
        loading: false,
        filtersDefault: true,
        quietMode: true,
        timeWindow: "all",
      }),
    ).toBe("quiet");
  });

  it("returns filters for other active gates with no visible rows", () => {
    expect(
      classifyFeedEmpty({
        catalystCount: 0,
        visibleCount: 0,
        loading: false,
        filtersDefault: false,
        quietMode: false,
        timeWindow: "all",
      }),
    ).toBe("filters");
  });
});
