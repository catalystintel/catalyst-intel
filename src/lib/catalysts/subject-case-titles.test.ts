import { describe, expect, it } from "vitest";

import {
  buildCaseEngineTitle,
  identifyPrimaryEngineSubject,
} from "./subject-case-titles";
import { buildSubjectTitle } from "./subject-titles";

describe("subject-case-titles engine", () => {
  it("identifies FINANCING for registered direct offering (not partnership)", () => {
    expect(
      identifyPrimaryEngineSubject(
        {
          eventCategory: "capital",
          companyName: "ABC",
          summary: "ABC announces a $100M registered direct offering.",
        },
        [{ label: "Amount", value: "$100M" }],
      ),
    ).toBe("financing");
  });

  it("identifies REGULATORY as primary when FDA approves after Phase 3", () => {
    expect(
      identifyPrimaryEngineSubject(
        {
          eventCategory: "regulatory",
          companyName: "ABC",
          summary:
            "FDA approves ABC's drug following successful Phase 3 results.",
        },
        [
          { label: "Agency", value: "FDA" },
          { label: "Outcome", value: "approval" },
          { label: "Product", value: "DrugX" },
        ],
      ),
    ).toBe("regulatory");
  });

  it("identifies PARTNERSHIP for collab to develop a drug (not clinical)", () => {
    expect(
      identifyPrimaryEngineSubject(
        {
          eventCategory: "deals",
          companyName: "Company X",
          summary:
            "Company X announces a partnership with Company Y to develop its cancer drug.",
        },
        [{ label: "Partner", value: "Company Y" }],
      ),
    ).toBe("partnership");
  });

  it("F3 registered direct with price", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "capital",
          companyName: "ABC",
          summary:
            "ABC announces a $50M registered direct offering at $2.50/share.",
        },
        [
          { label: "Amount", value: "$50M" },
          { label: "Price", value: "$2.50/share" },
        ],
      ),
    ).toBe("ABC Prices $50M Registered Direct Offering at $2.50/Share");
  });

  it("M1 acquisition with deal value", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "deals",
          companyName: "ABC",
          summary: "ABC agrees to acquire XYZ for $400M.",
        },
        [
          { label: "Target", value: "XYZ" },
          { label: "Deal value", value: "$400M" },
        ],
      ),
    ).toBe("ABC Agrees to Acquire XYZ for $400M");
  });

  it("R1 FDA approval (not clinical title)", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "regulatory",
          companyName: "ABC",
          summary: "FDA approves ABC's drug for treatment of cancer.",
        },
        [
          { label: "Agency", value: "FDA" },
          { label: "Outcome", value: "approval" },
          { label: "Product", value: "DrugX" },
        ],
      ),
    ).toBe("FDA Approves ABC's DrugX");
  });

  it("P1 partnership with deal value", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "deals",
          companyName: "ABC",
          summary: "ABC signs a $200M strategic partnership with Microsoft.",
        },
        [
          { label: "Partner", value: "Microsoft" },
          { label: "Amount", value: "$200M" },
          { label: "Type", value: "Partnership" },
        ],
      ),
    ).toBe("ABC Enters $200M Partnership With Microsoft");
  });

  it("C1 primary endpoint met with improvement", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "clinical",
          companyName: "ABC",
          summary:
            "ABC reports Phase 3 trial met its primary endpoint with a 42% improvement.",
        },
        [
          { label: "Phase", value: "3" },
          { label: "Status", value: "met primary endpoint" },
          { label: "Improvement", value: "42%" },
        ],
      ),
    ).toBe("ABC Phase 3 Trial Meets Primary Endpoint With 42% Improvement");
  });

  it("does not apply engine to earnings / insider subjects", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "earnings",
          companyName: "ABC",
          summary: "ABC reports Q2 earnings.",
        },
        [{ label: "EPS", value: "$1.20" }],
      ),
    ).toBeNull();
  });

  it("buildSubjectTitle uses case engine for capital while keeping earnings path", () => {
    expect(
      buildSubjectTitle({
        eventCategory: "capital",
        companyName: "ABC",
        summary: "ABC announces a $75M public offering.",
        keyFacts: [{ label: "Amount", value: "$75M" }],
      }),
    ).toMatch(/ABC Announces \$75M/);

    expect(
      buildSubjectTitle({
        eventCategory: "earnings",
        companyName: "ABC",
        quarter: 2,
        keyFacts: [{ label: "EPS", value: "$1.20 beat vs $1.10 est" }],
      }),
    ).toMatch(/EPS beats/i);
  });
});
