import { describe, expect, it } from "vitest";

import { buildMap } from "./ticker-lookup";

describe("buildMap", () => {
  it("maps CIK to ticker", () => {
    const map = buildMap({
      "0": { cik_str: 1141197, ticker: "PED", title: "PEDEVCO CORP" },
      "1": { cik_str: 1850079, ticker: "SOBR", title: "SOBR Safe, Inc." },
    });

    expect(map.get(1141197)).toBe("PED");
    expect(map.get(1850079)).toBe("SOBR");
    expect(map.size).toBe(2);
  });

  it("skips entries missing a cik or ticker", () => {
    const map = buildMap({
      "0": { cik_str: 1141197, ticker: "", title: "No ticker" },
      // @ts-expect-error - intentionally malformed to test the guard
      "1": { ticker: "NOCIK", title: "No CIK" },
    });

    expect(map.size).toBe(0);
  });
});
