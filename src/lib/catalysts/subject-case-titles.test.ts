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

  it("M2 per-share acquisition", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "deals",
          companyName: "ABC",
          summary: "ABC to acquire XYZ for $12.50 per share.",
        },
        [
          { label: "Target", value: "XYZ" },
          { label: "Price", value: "$12.50/share" },
        ],
      ),
    ).toBe("ABC to Acquire XYZ for $12.50/Share");
  });

  it("M6 completes acquisition", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "deals",
          companyName: "ABC",
          summary: "ABC completes acquisition of XYZ.",
        },
        [
          { label: "Target", value: "XYZ" },
          { label: "Status", value: "closed" },
        ],
      ),
    ).toBe("ABC Completes Acquisition of XYZ");
  });

  it("M7 merger", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "deals",
          companyName: "ABC",
          summary: "ABC agrees to merge with XYZ.",
        },
        [{ label: "Target", value: "XYZ" }],
      ),
    ).toBe("ABC Agrees to Merge With XYZ");
  });

  it("M13 definitive agreement", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "deals",
          companyName: "ABC",
          summary: "ABC enters definitive agreement to acquire XYZ.",
        },
        [{ label: "Target", value: "XYZ" }],
      ),
    ).toBe("ABC Enters Definitive Agreement to Acquire XYZ");
  });

  it("M15 all-stock deal", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "deals",
          companyName: "ABC",
          summary: "ABC to acquire XYZ in an all-stock deal.",
        },
        [
          { label: "Target", value: "XYZ" },
          { label: "Consideration", value: "all-stock" },
        ],
      ),
    ).toBe("ABC to Acquire XYZ in All-Stock Deal");
  });

  it("M17 premium", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "deals",
          companyName: "ABC",
          summary: "ABC agrees to acquire XYZ at a 28% premium.",
        },
        [
          { label: "Target", value: "XYZ" },
          { label: "Premium", value: "28%" },
        ],
      ),
    ).toBe("ABC Agrees to Acquire XYZ at 28% Premium");
  });

  it("M18 completes valued acquisition", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "deals",
          companyName: "ABC",
          summary: "ABC completes $400M acquisition of XYZ.",
        },
        [
          { label: "Target", value: "XYZ" },
          { label: "Deal value", value: "$400M" },
          { label: "Status", value: "closed" },
        ],
      ),
    ).toBe("ABC Completes $400M Acquisition of XYZ");
  });

  it("M11 asset purchase", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "deals",
          companyName: "ABC",
          summary: "ABC to acquire the Widgets division for $90M.",
        },
        [
          { label: "Asset", value: "Widgets division" },
          { label: "Deal value", value: "$90M" },
        ],
      ),
    ).toBe("ABC to Acquire Widgets division for $90M");
  });

  it("uses Buyer fact when distinct from listing company", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "deals",
          companyName: "TargetCo",
          summary: "BigBuyer agrees to acquire TargetCo for $1.2B.",
        },
        [
          { label: "Buyer", value: "BigBuyer" },
          { label: "Target", value: "TargetCo" },
          { label: "Deal value", value: "$1.2B" },
        ],
      ),
    ).toBe("BigBuyer Agrees to Acquire TargetCo for $1.2B");
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

  it("F2 prices offering when priced with size", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "capital",
          companyName: "ABC",
          summary: "ABC priced a $200M public offering at $18.00 per share.",
        },
        [
          { label: "Amount", value: "$200M" },
          { label: "Price", value: "$18.00/share" },
        ],
      ),
    ).toBe("ABC Prices $200M Offering at $18.00/Share");
  });

  it("F5 shelf/ATM/424B use files/sets-up voice; stake parens only when thin", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "capital",
          companyName: "ABC",
          type: "S-3",
          summary: "Shelf registration for up to $500 million.",
        },
        [
          { label: "Form", value: "S-3" },
          { label: "Amount", value: "$500M" },
          { label: "Type", value: "Shelf registration" },
        ],
      ),
    ).toBe("ABC files $500M shelf registration");

    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "capital",
          companyName: "ABC",
          type: "S-3",
        },
        [
          { label: "Form", value: "S-3" },
          { label: "Type", value: "Shelf registration" },
        ],
      ),
    ).toBe("ABC - Shelf Registration Filed (Capital Raise Window)");

    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "capital",
          companyName: "ABC",
          type: "424B5",
        },
        [{ label: "Form", value: "424B5" }],
      ),
    ).toBe("ABC - Stock Offering Filed (Dilution Ahead)");
  });

  it("F5 thin unknown instrument uses Stock Offering ground-rule (not Announces Financing)", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "capital",
          companyName: "AGPU",
          symbol: "AGPU",
          title: "AGPU Announces Financing",
        },
        [],
      ),
    ).toBe("AGPU - Stock Offering Filed (Dilution Ahead)");
  });

  it("M&A taxonomy chip upgrades to Acquisition Announced thin", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "deals",
          companyName: null,
          symbol: "SDOT",
          title: "M&A / acquisition",
          headline: "M&A / acquisition",
        },
        [],
      ),
    ).toBe("SDOT - Acquisition Announced (Deal in Play)");
  });

  it("R1 prefers agency+product; bang only when product unknown", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "regulatory",
          companyName: "ABC",
          summary: "FDA approves ABC's drug.",
        },
        [
          { label: "Agency", value: "FDA" },
          { label: "Outcome", value: "approval" },
        ],
      ),
    ).toBe("ABC Receives FDA Approval!");

    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "regulatory",
          companyName: "ABC",
          summary: "FDA approves ABC's DrugX.",
        },
        [
          { label: "Agency", value: "FDA" },
          { label: "Outcome", value: "approval" },
          { label: "Product", value: "DrugX" },
        ],
      ),
    ).toBe("FDA Approves ABC's DrugX");
  });

  it("P2 named partner over thin strategic partnership chip", () => {
    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "deals",
          companyName: "ABC",
          summary: "ABC announces a strategic partnership with Microsoft.",
        },
        [
          { label: "Partner", value: "Microsoft" },
          { label: "Type", value: "Partnership" },
        ],
      ),
    ).toBe("ABC partners with Microsoft");

    expect(
      buildCaseEngineTitle(
        {
          eventCategory: "deals",
          companyName: "ABC",
          summary: "ABC announces a strategic partnership.",
        },
        [{ label: "Type", value: "Partnership" }],
      ),
    ).toBe("ABC - Strategic Partnership Announced");
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
