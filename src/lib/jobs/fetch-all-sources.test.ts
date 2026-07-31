import { describe, expect, it } from "vitest";

import {
  CATALYST_SOURCE_CATALOG,
  CATALYST_SOURCE_IDS,
  FETCH_PHASES,
  activeCatalystSourceIds,
  isCatalystSourceFetchEnabled,
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
      "macro-calendar",
      "pr-wire",
      "finnhub",
      "openfda",
      "clinicaltrials",
      "polygon-news",
      "polygon-prices",
      "fmp-econ-calendar",
    ]);
  });

  it("keeps catalog order aligned with CATALYST_SOURCE_IDS", () => {
    expect(CATALYST_SOURCE_CATALOG.map((s) => s.id)).toEqual([
      ...CATALYST_SOURCE_IDS,
    ]);
    expect(CATALYST_SOURCE_CATALOG.map((s) => s.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it("defines phased parallel A → B → C (paused sources omitted)", () => {
    expect(FETCH_PHASES.map((p) => p.id)).toEqual(["A", "B", "C"]);
    expect(FETCH_PHASES[0]).toMatchObject({
      mode: "parallel",
      sources: ["sec-edgar", "nasdaq-halts", "macro-calendar", "openfda"],
    });
    expect(FETCH_PHASES[1]).toMatchObject({
      mode: "parallel",
      sources: ["pr-wire", "finnhub"],
    });
    expect(FETCH_PHASES[2]).toMatchObject({
      mode: "sequential",
      sources: ["polygon-prices"],
    });
  });

  it("covers every fetch/all-active catalog id exactly once across phases", () => {
    const fromPhases = FETCH_PHASES.flatMap((p) => [...p.sources]);
    expect(fromPhases.sort()).toEqual([...activeCatalystSourceIds()].sort());
  });

  it("keeps FMP econ on dedicated cron (excluded from fetch/all)", () => {
    expect(isCatalystSourceFetchEnabled("fmp-econ-calendar")).toBe(true);
    expect(activeCatalystSourceIds()).not.toContain("fmp-econ-calendar");
    expect(
      CATALYST_SOURCE_CATALOG.find((s) => s.id === "fmp-econ-calendar")
        ?.includeInFetchAll,
    ).toBe(false);
  });

  it("keeps clinicaltrials and polygon-news paused (not deleted)", () => {
    expect(isCatalystSourceFetchEnabled("clinicaltrials")).toBe(false);
    expect(isCatalystSourceFetchEnabled("polygon-news")).toBe(false);
    expect(isCatalystSourceFetchEnabled("openfda")).toBe(true);
    expect(CATALYST_SOURCE_IDS).toContain("clinicaltrials");
    expect(CATALYST_SOURCE_IDS).toContain("polygon-news");
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
