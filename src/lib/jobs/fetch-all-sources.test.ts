import { describe, expect, it } from "vitest";

import { CATALYST_SOURCE_IDS, isCatalystSourceId } from "./catalyst-sources";
import { skippedSourceResult } from "./ingest-pipeline";

describe("isCatalystSourceId", () => {
  it("accepts known sources", () => {
    for (const id of CATALYST_SOURCE_IDS) {
      expect(isCatalystSourceId(id)).toBe(true);
    }
  });

  it("rejects unknown sources", () => {
    expect(isCatalystSourceId("courtlistener")).toBe(false);
  });
});

describe("skippedSourceResult", () => {
  it("marks configured false and status skipped", () => {
    const result = skippedSourceResult("polygon-news", "missing key");
    expect(result).toMatchObject({
      source: "polygon-news",
      configured: false,
      status: "skipped",
      message: "missing key",
      inserted: 0,
    });
  });
});
