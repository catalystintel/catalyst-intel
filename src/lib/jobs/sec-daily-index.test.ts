import { describe, expect, it } from "vitest";

import {
  accessionFromMasterFileName,
  addDaysYyyymmdd,
  filingDateToIso,
  formMatchesAnyConfigured,
  formMatchesConfiguredType,
  formatReconciledThroughMessage,
  masterIdxUrl,
  masterRowToNormalized,
  parseMasterIdx,
  parseReconciledThrough,
  quarterPathForYyyymmdd,
  yyyymmddInEt,
} from "./sec-daily-index";

const SAMPLE_IDX = `Description: Daily Index of EDGAR Dissemination Feed
Last Data Received: Jul 24, 2026
Comments: webmaster@sec.gov

CIK|Company Name|Form Type|Date Filed|File Name
--------------------------------------------------------------------------------
1001250|ESTEE LAUDER COMPANIES INC|8-K|20260724|edgar/data/1001250/0001001250-26-000033.txt
1001838|SOUTHERN COPPER CORP/|4|20260724|edgar/data/1001838/0001284489-26-000022.txt
1004158|GS MORTGAGE SECURITIES CORP II|ABS-15G|20260724|edgar/data/1004158/0001539497-26-002007.txt
1000275|ROYAL BANK OF CANADA|424B2|20260724|edgar/data/1000275/0000950103-26-011123.txt
1009268|D. E. SHAW & CO, L.P.|SCHEDULE 13D/A|20260724|edgar/data/1009268/0001104659-26-086735.txt
1009759|Capstone Energy Plus, Inc.|S-3/A|20260724|edgar/data/1009759/0001104659-26-086646.txt
`;

describe("parseMasterIdx", () => {
  it("parses pipe rows after the dashed header", () => {
    const rows = parseMasterIdx(SAMPLE_IDX);
    expect(rows.length).toBe(6);
    expect(rows[0]).toMatchObject({
      cik: 1001250,
      companyName: "ESTEE LAUDER COMPANIES INC",
      formType: "8-K",
      dateFiled: "20260724",
      accessionNumber: "0001001250-26-000033",
    });
  });
});

describe("formMatchesConfiguredType", () => {
  it("matches 8-K and amendments", () => {
    expect(formMatchesConfiguredType("8-K", "8-K")).toBe(true);
    expect(formMatchesConfiguredType("8-K/A", "8-K")).toBe(true);
  });

  it("matches Form 4 without matching 424B", () => {
    expect(formMatchesConfiguredType("4", "4")).toBe(true);
    expect(formMatchesConfiguredType("4/A", "4")).toBe(true);
    expect(formMatchesConfiguredType("424B2", "4")).toBe(false);
  });

  it("matches capital and ownership forms", () => {
    expect(formMatchesConfiguredType("424B2", "424B")).toBe(true);
    expect(formMatchesConfiguredType("S-3/A", "S-3")).toBe(true);
    expect(formMatchesConfiguredType("SCHEDULE 13D/A", "SC 13D")).toBe(true);
    expect(formMatchesConfiguredType("SC 13G", "SC 13G")).toBe(true);
  });

  it("filters ABS-15G out of configured set", () => {
    expect(formMatchesAnyConfigured("ABS-15G")).toBe(false);
    expect(formMatchesAnyConfigured("8-K")).toBe(true);
  });
});

describe("accessionFromMasterFileName", () => {
  it("pulls accession from edgar path", () => {
    expect(
      accessionFromMasterFileName(
        "edgar/data/1001250/0001001250-26-000033.txt",
      ),
    ).toBe("0001001250-26-000033");
  });
});

describe("masterIdxUrl / quarterPath", () => {
  it("builds QTR path", () => {
    expect(quarterPathForYyyymmdd("20260724")).toEqual({
      year: "2026",
      qtr: 3,
    });
    expect(masterIdxUrl("20260724")).toBe(
      "https://www.sec.gov/Archives/edgar/daily-index/2026/QTR3/master.20260724.idx",
    );
  });
});

describe("reconcile message helpers", () => {
  it("round-trips reconciledThrough", () => {
    const msg = formatReconciledThroughMessage("20260724");
    expect(parseReconciledThrough(msg)).toBe("20260724");
    expect(parseReconciledThrough("other")).toBeNull();
  });
});

describe("date helpers", () => {
  it("adds days to yyyymmdd", () => {
    expect(addDaysYyyymmdd("20260724", -1)).toBe("20260723");
    expect(addDaysYyyymmdd("20260701", -1)).toBe("20260630");
  });

  it("formats filing date to ISO noon UTC", () => {
    expect(filingDateToIso("20260724")).toBe("2026-07-24T12:00:00.000Z");
  });

  it("returns an 8-digit ET calendar day", () => {
    expect(yyyymmddInEt(new Date("2026-07-25T18:00:00.000Z"))).toMatch(
      /^\d{8}$/,
    );
  });
});

describe("masterRowToNormalized", () => {
  it("builds stable externalId and daily-index tag", () => {
    const rows = parseMasterIdx(SAMPLE_IDX);
    const eightK = rows.find((r) => r.formType === "8-K")!;
    const item = masterRowToNormalized(eightK, new Map([[1001250, "EL"]]));
    expect(item).toMatchObject({
      provider: "sec-edgar",
      externalId: "sec-edgar:0001001250-26-000033",
      symbol: "EL",
      type: "8-K",
    });
    expect(item?.tags).toContain("daily-index");
    expect(item?.url).toContain("0001001250-26-000033-index.htm");
  });

  it("returns null for non-configured forms", () => {
    const rows = parseMasterIdx(SAMPLE_IDX);
    const abs = rows.find((r) => r.formType === "ABS-15G")!;
    expect(masterRowToNormalized(abs, new Map())).toBeNull();
  });

  it("does not double-insert path — externalId matches Atom shape", () => {
    const rows = parseMasterIdx(SAMPLE_IDX);
    const form4 = rows.find((r) => r.formType === "4")!;
    const item = masterRowToNormalized(form4, new Map());
    expect(item?.externalId).toBe(`sec-edgar:${form4.accessionNumber}`);
  });
});
