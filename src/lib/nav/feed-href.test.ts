import { describe, expect, it } from "vitest";

import { feedHref, parseFeedCatalystId } from "./feed-href";

describe("feedHref", () => {
  it("returns bare feed path with no opts", () => {
    expect(feedHref()).toBe("/catalyst-feed");
    expect(feedHref({})).toBe("/catalyst-feed");
  });

  it("encodes catalyst id as c", () => {
    expect(feedHref({ catalystId: 42 })).toBe("/catalyst-feed?c=42");
  });

  it("encodes symbol and catalyst together", () => {
    expect(feedHref({ symbol: "fhb", catalystId: 7 })).toBe(
      "/catalyst-feed?symbol=FHB&c=7",
    );
  });

  it("ignores invalid catalyst ids", () => {
    expect(feedHref({ catalystId: 0 })).toBe("/catalyst-feed");
    expect(feedHref({ catalystId: null })).toBe("/catalyst-feed");
  });
});

describe("parseFeedCatalystId", () => {
  it("parses positive integer strings", () => {
    expect(parseFeedCatalystId("12")).toBe(12);
  });

  it("rejects junk", () => {
    expect(parseFeedCatalystId(undefined)).toBeUndefined();
    expect(parseFeedCatalystId("")).toBeUndefined();
    expect(parseFeedCatalystId("12x")).toBeUndefined();
    expect(parseFeedCatalystId("0")).toBeUndefined();
  });
});
