import { describe, expect, it } from "vitest";

import {
  extractDollarAmount,
  extractFromFilingText,
  filingTextFromHtml,
  isAtomMetadataOnly,
  mentionsAtm,
  pickPrimaryDocumentUrl,
} from "./sec-filing-extract";

describe("isAtomMetadataOnly", () => {
  it("flags AccNo/Size blurbs", () => {
    expect(
      isAtomMetadataOnly(
        "Filed: 2026-07-24 AccNo: 0001193125-26-316280 Size: 973 KB",
      ),
    ).toBe(true);
  });

  it("keeps item-rich 8-K blurbs", () => {
    expect(
      isAtomMetadataOnly(
        "Filed: 2026-07-24 AccNo: 0001 Size: 10 KB Item 5.02: Departure of Directors or Certain Officers; Election of Directors",
      ),
    ).toBe(false);
  });
});

describe("extractDollarAmount / ATM", () => {
  it("finds shelf dollars and ATM language", () => {
    const text =
      "maximum aggregate offering price of $500 million under an at-the-market offering program";
    expect(extractDollarAmount(text)).toMatch(/\$500 million/i);
    expect(mentionsAtm(text)).toBe(true);
  });
});

describe("extractFromFilingText", () => {
  it("builds investor S-3 summary without AccNo", () => {
    const extract = extractFromFilingText({
      formType: "S-3/A",
      text: "This prospectus covers a maximum aggregate offering price of $250 million. The Trust may sell shares in an at-the-market offering.",
      ticker: "FETH",
      companyName: "Fidelity Ethereum Fund",
    });
    expect(extract.investorSummary).toMatch(/shelf/i);
    expect(extract.investorSummary).not.toMatch(/AccNo/i);
    expect(extract.keyFacts.some((f) => f.label === "Amount")).toBe(true);
    expect(extract.titleOverride).toMatch(/FETH/);
  });

  it("builds 424B offering Amount/Shares keyFacts", () => {
    const extract = extractFromFilingText({
      formType: "424B2",
      text: "The company is offering 12,500,000 shares of common stock at a public offering price of $18.00 per share. Aggregate offering price $225 million.",
      ticker: "C-PR",
      companyName: "Citigroup Inc.",
    });
    expect(extract.eventKind).toBe("priced_offering");
    expect(extract.investorSummary).not.toMatch(/AccNo/i);
    expect(extract.keyFacts.some((f) => f.label === "Amount")).toBe(true);
    expect(extract.keyFacts.some((f) => f.label === "Shares")).toBe(true);
    expect(extract.keyFacts.some((f) => f.label === "Form")).toBe(true);
  });

  it("classifies structured-note 424B pricing supplements", () => {
    const extract = extractFromFilingText({
      formType: "424B2",
      text: "PRELIMINARY PRICING SUPPLEMENT. Stated principal amount. contingent coupon rate of 8.67% per annum if and only if the worst performing underlying. The securities are unsecured debt securities.",
      ticker: "C-PR",
      companyName: "CITIGROUP INC",
    });
    expect(extract.eventKind).toBe("structured_note");
    expect(extract.keyFacts.some((f) => f.label === "Coupon")).toBe(true);
    expect(extract.investorSummary).not.toMatch(
      /AccNo|dilution|read coupon barriers/i,
    );
    expect(extract.investorSummary).toMatch(/structured notes|debt-linked/i);
    expect(extract.titleOverride).toMatch(/Structured note/i);
  });

  it("builds 13D ownership extract", () => {
    const extract = extractFromFilingText({
      formType: "SC 13D",
      text: "The Reporting Person beneficially owns 9.8% of the outstanding common stock.",
      ticker: "ACME",
      companyName: "Acme Corp",
    });
    expect(extract.investorSummary).toMatch(/9\.8%/);
    expect(extract.eventKind).toBe("13d");
    expect(extract.keyFacts.some((f) => f.label === "Ownership")).toBe(true);
  });
});

describe("filingTextFromHtml / pickPrimaryDocumentUrl", () => {
  it("strips tags", () => {
    expect(filingTextFromHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("prefers 424B prospectus over exhibits", () => {
    const index = `
      <table>
        <tr><td>1</td><td>Cover</td><td><a href="cover.htm">cover.htm</a></td><td>COVER</td></tr>
        <tr><td>2</td><td>Prospectus Supplement</td><td><a href="d424b2.htm">d424b2.htm</a></td><td>424B2</td></tr>
        <tr><td>3</td><td>Exhibit 99.1</td><td><a href="ex99.htm">ex99.htm</a></td><td>EX-99.1</td></tr>
      </table>`;
    const url = pickPrimaryDocumentUrl(
      index,
      "https://www.sec.gov/Archives/edgar/data/1/0001/0001-index.htm",
      "424B2",
    );
    expect(url).toContain("d424b2.htm");
  });

  it("resolves absolute /Archives hrefs against sec.gov (not filing folder)", () => {
    const index = `
      <table class="tableFile">
         <tr>
            <td scope="row">1</td>
            <td scope="row">PRELIMINARY PRICING SUPPLEMENT</td>
            <td scope="row"><a href="/Archives/edgar/data/200245/000191870426021223/form424b2.htm">form424b2.htm</a></td>
            <td scope="row">424B2</td>
            <td scope="row">189357</td>
         </tr>
      </table>`;
    const url = pickPrimaryDocumentUrl(
      index,
      "https://www.sec.gov/Archives/edgar/data/831001/000191870426021223/0001918704-26-021223-index.htm",
      "424B2",
    );
    expect(url).toBe(
      "https://www.sec.gov/Archives/edgar/data/200245/000191870426021223/form424b2.htm",
    );
  });

  it("picks form-matching primary doc", () => {
    const index = `
      <table>
        <tr><td>1</td><td>Prospectus</td><td><a href="d15998ds3a.htm">d15998ds3a.htm</a></td><td>S-3/A</td></tr>
        <tr><td>2</td><td>Graphic</td><td><a href="g15998.jpg">g15998.jpg</a></td><td>GRAPHIC</td></tr>
      </table>`;
    const url = pickPrimaryDocumentUrl(
      index,
      "https://www.sec.gov/Archives/edgar/data/1/0001/0001-index.htm",
      "S-3/A",
    );
    expect(url).toContain("d15998ds3a.htm");
  });
});
