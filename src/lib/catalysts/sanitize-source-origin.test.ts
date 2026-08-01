import { describe, expect, it } from "vitest";

import {
  looksLikeOriginLabel,
  scrubHistoricalImpact,
  scrubOriginHeadline,
  scrubOriginMentions,
  scrubOriginSubcategory,
  scrubOriginTags,
} from "./sanitize-source-origin";

describe("scrubOriginMentions", () => {
  it("strips wire-house bylines and datelines", () => {
    const body =
      "PR Newswire\nAUBURN HILLS, Mich., Aug. 1, 2026 /PRNewswire/ -- Dodge and LEGO partnered.";
    const cleaned = scrubOriginMentions(body);
    expect(cleaned).not.toMatch(/PR\s*Newswire/i);
    expect(cleaned).toMatch(/Dodge and LEGO/);
  });

  it("strips vendor names", () => {
    expect(scrubOriginMentions("Foo — Finnhub")).toBe("Foo");
    expect(scrubOriginMentions("openFDA: Bar")).toBe("Bar");
    expect(scrubOriginMentions("Polygon news")).toBe("news");
  });
});

describe("looksLikeOriginLabel / scrubOriginHeadline", () => {
  it("detects bare origin labels", () => {
    expect(looksLikeOriginLabel("Business Wire")).toBe(true);
    expect(looksLikeOriginLabel("PR Wire")).toBe(true);
    expect(looksLikeOriginLabel("Earnings beat")).toBe(false);
  });

  it("nulls headline that is only an origin", () => {
    expect(scrubOriginHeadline("Benzinga Wire")).toBeNull();
    expect(scrubOriginHeadline("Acme raises guidance")).toBe(
      "Acme raises guidance",
    );
  });
});

describe("scrubOriginTags / subcategory / historicalImpact", () => {
  it("drops vendor tags", () => {
    expect(
      scrubOriginTags(["finnhub", "earnings", "AAPL", "press-release", "wire"]),
    ).toEqual(["earnings", "AAPL"]);
  });

  it("maps leaking subcategories", () => {
    expect(scrubOriginSubcategory("pr_wire")).toBe("press_release");
    expect(scrubOriginSubcategory("benzinga_wire")).toBe("press_release");
    expect(scrubOriginSubcategory("openfda_approval")).toBe("fda_approval");
    expect(scrubOriginSubcategory("earnings")).toBe("earnings");
  });

  it("removes provider from historicalImpact", () => {
    expect(
      scrubHistoricalImpact({
        provider: "pr-wire",
        pctChange: 12,
        status: "settled",
      }),
    ).toEqual({ pctChange: 12, status: "settled" });
  });
});
