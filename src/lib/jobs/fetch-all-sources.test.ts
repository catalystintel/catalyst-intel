import { describe, expect, it } from "vitest";

import {
  CATALYST_SOURCE_CATALOG,
  CATALYST_SOURCE_IDS,
  FETCH_PHASES,
  isCatalystSourceId,
} from "./catalyst-sources";
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

describe("fetch order catalog", () => {
  it("lists Must→Should sources in documented order", () => {
    expect([...CATALYST_SOURCE_IDS]).toEqual([
      "sec-edgar",
      "nasdaq-halts",
      "finnhub",
      "openfda",
      "clinicaltrials",
      "polygon-news",
      "polygon-prices",
      "form4api",
    ]);
  });

  it("keeps catalog order aligned with CATALYST_SOURCE_IDS", () => {
    expect(CATALYST_SOURCE_CATALOG.map((s) => s.id)).toEqual([
      ...CATALYST_SOURCE_IDS,
    ]);
    expect(CATALYST_SOURCE_CATALOG.map((s) => s.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it("defines phased parallel A → B → C with Polygon sequential", () => {
    expect(FETCH_PHASES.map((p) => p.id)).toEqual(["A", "B", "C"]);
    expect(FETCH_PHASES[0]).toMatchObject({
      mode: "parallel",
      sources: ["sec-edgar", "nasdaq-halts", "openfda", "clinicaltrials"],
    });
    expect(FETCH_PHASES[1]).toMatchObject({
      mode: "parallel",
      sources: ["finnhub", "form4api"],
    });
    expect(FETCH_PHASES[2]).toMatchObject({
      mode: "sequential",
      sources: ["polygon-news", "polygon-prices"],
    });
  });

  it("covers every catalog id exactly once across phases", () => {
    const fromPhases = FETCH_PHASES.flatMap((p) => [...p.sources]);
    expect(fromPhases.sort()).toEqual([...CATALYST_SOURCE_IDS].sort());
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
