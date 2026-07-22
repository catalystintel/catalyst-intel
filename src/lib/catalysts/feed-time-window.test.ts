import { describe, expect, it } from "vitest";

import {
  FEED_TIME_WINDOWS,
  RECENT_WINDOW_MINUTES,
  feedLimitForTimeWindow,
  minutesForFeedTimeWindow,
  parseFeedTimeWindow,
  sinceIsoForFeedTimeWindow,
} from "./feed-time-window";

describe("feed-time-window", () => {
  it("exposes Recent + hour chips including 12h", () => {
    expect(FEED_TIME_WINDOWS.map((w) => w.id)).toEqual([
      "recent",
      "1h",
      "4h",
      "12h",
      "24h",
      "all",
    ]);
    expect(RECENT_WINDOW_MINUTES).toBe(30);
    expect(minutesForFeedTimeWindow("recent")).toBe(30);
    expect(minutesForFeedTimeWindow("12h")).toBe(12 * 60);
    expect(minutesForFeedTimeWindow("all")).toBeNull();
  });

  it("parses window query values with all as default", () => {
    expect(parseFeedTimeWindow("recent")).toBe("recent");
    expect(parseFeedTimeWindow("12h")).toBe("12h");
    expect(parseFeedTimeWindow("nope")).toBe("all");
    expect(parseFeedTimeWindow(null)).toBe("all");
  });

  it("computes since ISO from article-time windows", () => {
    const now = Date.parse("2026-07-22T12:00:00.000Z");
    expect(sinceIsoForFeedTimeWindow("recent", now)).toBe(
      "2026-07-22T11:30:00.000Z",
    );
    expect(sinceIsoForFeedTimeWindow("1h", now)).toBe(
      "2026-07-22T11:00:00.000Z",
    );
    expect(sinceIsoForFeedTimeWindow("all", now)).toBeNull();
  });

  it("uses a higher limit for All", () => {
    expect(feedLimitForTimeWindow("recent")).toBe(100);
    expect(feedLimitForTimeWindow("all")).toBe(200);
  });
});
