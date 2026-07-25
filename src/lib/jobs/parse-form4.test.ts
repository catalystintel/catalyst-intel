import { describe, expect, it } from "vitest";

import type { NormalizedCatalyst } from "@/lib/jobs/ingest-pipeline";

import {
  accessionFromSecExternalId,
  accessionToFolder,
  candidateForm4XmlUrls,
  extractForm4XmlHrefsFromIndex,
  isForm4Normalized,
  parseForm4OwnershipXml,
} from "./parse-form4";

const BUY_XML = `<?xml version="1.0"?>
<ownershipDocument>
  <nonDerivativeTable>
    <nonDerivativeTransaction>
      <transactionCoding>
        <transactionCode>P</transactionCode>
      </transactionCoding>
    </nonDerivativeTransaction>
  </nonDerivativeTable>
</ownershipDocument>`;

const SELL_XML = `<?xml version="1.0"?>
<ownershipDocument>
  <nonDerivativeTable>
    <nonDerivativeTransaction>
      <transactionCoding>
        <transactionCode>S</transactionCode>
      </transactionCoding>
    </nonDerivativeTransaction>
  </nonDerivativeTable>
</ownershipDocument>`;

const MIXED_XML = `<?xml version="1.0"?>
<ownershipDocument>
  <nonDerivativeTable>
    <nonDerivativeTransaction>
      <transactionCoding><transactionCode>P</transactionCode></transactionCoding>
    </nonDerivativeTransaction>
    <nonDerivativeTransaction>
      <transactionCoding><transactionCode>S</transactionCode></transactionCoding>
    </nonDerivativeTransaction>
  </nonDerivativeTable>
</ownershipDocument>`;

const UNKNOWN_XML = `<?xml version="1.0"?>
<ownershipDocument>
  <nonDerivativeTable>
    <nonDerivativeTransaction>
      <transactionCoding><transactionCode>X</transactionCode></transactionCoding>
    </nonDerivativeTransaction>
  </nonDerivativeTable>
</ownershipDocument>`;

const TAX_WITHHOLD_XML = `<?xml version="1.0"?>
<ownershipDocument>
  <nonDerivativeTable>
    <nonDerivativeTransaction>
      <transactionCoding><transactionCode>F</transactionCode></transactionCoding>
    </nonDerivativeTransaction>
  </nonDerivativeTable>
</ownershipDocument>`;

const AWARD_XML = `<?xml version="1.0"?>
<ownershipDocument>
  <nonDerivativeTable>
    <nonDerivativeTransaction>
      <transactionCoding><transactionCode>A</transactionCode></transactionCoding>
    </nonDerivativeTransaction>
  </nonDerivativeTable>
</ownershipDocument>`;

describe("parseForm4OwnershipXml", () => {
  it("classifies open-market P as insider_buy", () => {
    expect(parseForm4OwnershipXml(BUY_XML)).toMatchObject({
      subcategory: "insider_buy",
      buyCount: 1,
      sellCount: 0,
    });
  });

  it("classifies open-market S as insider_sell", () => {
    expect(parseForm4OwnershipXml(SELL_XML)).toMatchObject({
      subcategory: "insider_sell",
      buyCount: 0,
      sellCount: 1,
    });
  });

  it("classifies mixed buy and sell as form4_mixed", () => {
    expect(parseForm4OwnershipXml(MIXED_XML)).toMatchObject({
      subcategory: "form4_mixed",
      buyCount: 1,
      sellCount: 1,
    });
  });

  it("marks tax withholding / awards as form4_routine", () => {
    expect(parseForm4OwnershipXml(TAX_WITHHOLD_XML)).toMatchObject({
      subcategory: "form4_routine",
    });
    expect(parseForm4OwnershipXml(AWARD_XML)).toMatchObject({
      subcategory: "form4_routine",
    });
  });

  it("falls back to form4 for unknown codes", () => {
    expect(parseForm4OwnershipXml(UNKNOWN_XML)).toMatchObject({
      subcategory: "form4",
    });
  });

  it("returns null for invalid XML", () => {
    expect(parseForm4OwnershipXml("not xml")).toBeNull();
  });
});

describe("Form 4 URL helpers", () => {
  it("accessionToFolder strips dashes", () => {
    expect(accessionToFolder("0001141197-26-000001")).toBe(
      "000114119726000001",
    );
  });

  it("accessionFromSecExternalId parses sec-edgar ids", () => {
    expect(accessionFromSecExternalId("sec-edgar:0001141197-26-000001")).toBe(
      "0001141197-26-000001",
    );
    expect(accessionFromSecExternalId("finnhub:news:1")).toBeNull();
  });

  it("candidateForm4XmlUrls builds archive paths", () => {
    const urls = candidateForm4XmlUrls(1141197, "0001141197-26-000001");
    expect(urls[0]).toBe(
      "https://www.sec.gov/Archives/edgar/data/1141197/000114119726000001/0001141197-26-000001.xml",
    );
  });

  it("extractForm4XmlHrefsFromIndex finds ownership links", () => {
    const html = `<a href="ownership.xml">doc</a><a href="other.txt">skip</a>`;
    expect(
      extractForm4XmlHrefsFromIndex(html, 1141197, "0001141197-26-000001"),
    ).toEqual([
      "https://www.sec.gov/Archives/edgar/data/1141197/000114119726000001/ownership.xml",
    ]);
  });

  it("isForm4Normalized detects Form 4 rows", () => {
    const form4: NormalizedCatalyst = {
      provider: "sec-edgar",
      externalId: "sec-edgar:0001141197-26-000001",
      rawContent: { formType: "4" },
      type: "4",
      title: "Test",
      eventCategory: "insider",
      timestamp: new Date().toISOString(),
    };
    const eightK: NormalizedCatalyst = {
      ...form4,
      rawContent: { formType: "8-K" },
      type: "8-K",
      eventCategory: "earnings",
    };
    expect(isForm4Normalized(form4)).toBe(true);
    expect(isForm4Normalized(eightK)).toBe(false);
  });
});
