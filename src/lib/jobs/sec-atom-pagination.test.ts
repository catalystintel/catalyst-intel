import { describe, expect, it } from "vitest";

import {
  SEC_ATOM_MAX_PAGES,
  SEC_ATOM_PAGE_SIZE,
  accessionFromAtomId,
  feedUrlForType,
  newestUpdatedIso,
  oldestUpdatedIso,
  secFormVendorSourceId,
  shouldPaginateFurther,
} from "./sec-atom-pagination";

describe("feedUrlForType", () => {
  it("omits start on page 0", () => {
    expect(feedUrlForType("8-K", 100, 0)).toBe(
      "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&output=atom&count=100",
    );
  });

  it("includes start for overflow pages", () => {
    expect(feedUrlForType("4", 100, 100)).toContain("count=100&start=100");
    expect(feedUrlForType("SC 13D", 100, 200)).toContain(
      "type=SC%2013D&output=atom&count=100&start=200",
    );
  });
});

describe("accessionFromAtomId", () => {
  it("extracts accession from Atom entry id", () => {
    expect(
      accessionFromAtomId(
        "urn:tag:sec.gov,2008:accession-number=0001001250-26-000033",
      ),
    ).toBe("0001001250-26-000033");
  });

  it("returns null when missing", () => {
    expect(accessionFromAtomId("urn:tag:sec.gov,2008:other")).toBeNull();
    expect(accessionFromAtomId(null)).toBeNull();
  });
});

describe("shouldPaginateFurther", () => {
  const base = {
    pageIndex: 0,
    pageEntryCount: SEC_ATOM_PAGE_SIZE,
    knownHit: false,
    watermarkIso: "2026-07-25T12:00:00.000Z",
    oldestUpdatedIso: "2026-07-25T12:30:00.000Z",
  };

  it("continues when page is full, unknown, and older than watermark gap", () => {
    expect(shouldPaginateFurther(base)).toBe(true);
  });

  it("stops when a known accession appears on the page", () => {
    expect(shouldPaginateFurther({ ...base, knownHit: true })).toBe(false);
  });

  it("stops when the page is short (last page)", () => {
    expect(shouldPaginateFurther({ ...base, pageEntryCount: 40 })).toBe(false);
  });

  it("stops at max pages", () => {
    expect(
      shouldPaginateFurther({
        ...base,
        pageIndex: SEC_ATOM_MAX_PAGES - 1,
      }),
    ).toBe(false);
  });

  it("continues on cold start (no watermark) when page is full of unknowns", () => {
    expect(
      shouldPaginateFurther({
        ...base,
        watermarkIso: null,
        oldestUpdatedIso: "2026-07-25T12:30:00.000Z",
      }),
    ).toBe(true);
  });

  it("stops when oldest on page is at or before watermark (caught up)", () => {
    expect(
      shouldPaginateFurther({
        ...base,
        oldestUpdatedIso: "2026-07-25T11:00:00.000Z",
      }),
    ).toBe(false);
  });
});

describe("newestUpdatedIso / oldestUpdatedIso", () => {
  it("picks newest and oldest", () => {
    const list = [
      "2026-07-25T10:00:00.000Z",
      "2026-07-25T12:00:00.000Z",
      "2026-07-25T11:00:00.000Z",
    ];
    expect(newestUpdatedIso(list)).toBe("2026-07-25T12:00:00.000Z");
    expect(oldestUpdatedIso(list)).toBe("2026-07-25T10:00:00.000Z");
  });

  it("ignores invalid", () => {
    expect(newestUpdatedIso([null, "nope"])).toBeNull();
  });
});

describe("secFormVendorSourceId", () => {
  it("namespaces per form", () => {
    expect(secFormVendorSourceId("8-K")).toBe("sec-edgar:8-K");
    expect(secFormVendorSourceId("4")).toBe("sec-edgar:4");
  });
});

describe("SEC_ATOM_MAX_PAGES", () => {
  it("allows 1000 filings per form per tick for hourly catch-up", () => {
    expect(SEC_ATOM_MAX_PAGES).toBe(10);
    expect(SEC_ATOM_MAX_PAGES * SEC_ATOM_PAGE_SIZE).toBe(1000);
  });
});
