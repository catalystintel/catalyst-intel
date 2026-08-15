import { describe, expect, it } from "vitest";

import {
  buildSubjectTitle,
  looksFactEnrichedTitle,
  preferSubjectTitle,
} from "./subject-titles";

describe("buildSubjectTitle", () => {
  it("builds earnings beat titles from EPS facts only", () => {
    expect(
      buildSubjectTitle({
        eventCategory: "earnings",
        companyName: "Acme Corp",
        quarter: 2,
        keyFacts: [{ label: "EPS", value: "$1.20 beat vs $1.10 est" }],
      }),
    ).toBe("Acme Corp Q2 EPS beats ($1.20 beat vs $1.10 est)");
  });

  it("builds M&A titles with value, target, and status", () => {
    expect(
      buildSubjectTitle({
        eventCategory: "deals",
        companyName: "Acme Corp",
        keyFacts: [
          { label: "Target", value: "Rival Inc" },
          { label: "Deal value", value: "$2.0B" },
        ],
      }),
    ).toBe("Acme Corp to acquire Rival Inc for $2.0B");

    expect(
      buildSubjectTitle({
        eventCategory: "deals",
        companyName: "Acme Corp",
        keyFacts: [
          { label: "Target", value: "Rival Inc" },
          { label: "Deal value", value: "$2.0B" },
          { label: "Status", value: "Closed" },
        ],
      }),
    ).toBe("Acme Corp closes $2.0B acquisition of Rival Inc");

    expect(
      buildSubjectTitle({
        eventCategory: "deals",
        companyName: "Acme Corp",
        keyFacts: [
          { label: "Target", value: "Rival Inc" },
          { label: "Status", value: "Terminated" },
        ],
      }),
    ).toBe("Acme Corp terminates acquisition of Rival Inc");
  });

  it("uses partnership voice when facts say collaboration / license", () => {
    expect(
      buildSubjectTitle({
        eventCategory: "deals",
        companyName: "Acme Corp",
        keyFacts: [
          { label: "Type", value: "Partnership" },
          { label: "Partner", value: "BioCo" },
          { label: "Nature", value: "oncology collaboration" },
        ],
      }),
    ).toBe("Acme Corp partners with BioCo — oncology collaboration");

    expect(
      buildSubjectTitle({
        eventCategory: "deals",
        companyName: "Acme Corp",
        keyFacts: [
          { label: "Type", value: "License agreement" },
          { label: "Partner", value: "BioCo" },
          { label: "Product", value: "DrugX" },
        ],
      }),
    ).toBe("Acme Corp licenses DrugX to BioCo");
  });

  it("falls back to ground-rule deal chip when deal facts are thin", () => {
    expect(
      buildSubjectTitle({
        eventCategory: "deals",
        companyName: "Acme Corp",
        keyFacts: [{ label: "Type", value: "Material agreement" }],
      }),
    ).toBe("Acme Corp - New Deal Announced (Major Contract or Partnership)");
  });

  it("builds insider titles with name and dollars", () => {
    expect(
      buildSubjectTitle({
        eventCategory: "insider",
        subcategory: "insider_buy",
        companyName: "Acme Corp",
        keyFacts: [
          { label: "Direction", value: "Buy" },
          { label: "Insider", value: "Jane Doe" },
          { label: "Value", value: "$1.2M" },
        ],
      }),
    ).toBe("Acme Corp insider buy: Jane Doe · $1.2M");
  });

  it("builds capital shelf / ATM / offering titles from size facts", () => {
    expect(
      buildSubjectTitle({
        eventCategory: "capital",
        symbol: "ACME",
        companyName: "Acme Corp",
        keyFacts: [
          { label: "Form", value: "S-3" },
          { label: "Type", value: "Shelf registration" },
          { label: "Amount", value: "$500M" },
        ],
      }),
    ).toBe("Acme Corp files $500M shelf registration");

    expect(
      buildSubjectTitle({
        eventCategory: "capital",
        companyName: "Acme Corp",
        keyFacts: [
          { label: "Type", value: "Shelf + ATM" },
          { label: "Facility", value: "At-the-market (ATM)" },
          { label: "Amount", value: "$100M" },
        ],
      }),
    ).toBe("Acme Corp sets up $100M at-the-market (ATM) program");

    expect(
      buildSubjectTitle({
        eventCategory: "capital",
        companyName: "Acme Corp",
        keyFacts: [
          { label: "Form", value: "424B2" },
          { label: "Type", value: "Prospectus supplement" },
          { label: "Amount", value: "$250M" },
          { label: "Shares", value: "12.5M shares" },
        ],
      }),
    ).toBe("Acme Corp files $250M equity offering (12.5M shares)");
  });

  it("builds 13D stake titles from ownership %", () => {
    expect(
      buildSubjectTitle({
        eventCategory: "deals",
        subcategory: "13d",
        symbol: "ACME",
        companyName: "Acme Corp",
        keyFacts: [
          { label: "Form", value: "SC 13D" },
          { label: "Ownership", value: "9.8%" },
        ],
      }),
    ).toBe("ACME — 13D stake ~9.8%");
  });

  it("builds clinical phase / primary-endpoint titles", () => {
    expect(
      buildSubjectTitle({
        eventCategory: "clinical",
        companyName: "BioCo",
        keyFacts: [
          { label: "Phase", value: "Phase 3" },
          { label: "Status", value: "met primary endpoint" },
          { label: "Condition", value: "NSCLC" },
        ],
      }),
    ).toBe("BioCo Phase 3 trial meets primary endpoint in NSCLC");

    expect(
      buildSubjectTitle({
        eventCategory: "clinical",
        companyName: "BioCo",
        keyFacts: [{ label: "Phase", value: "2" }],
      }),
    ).toBe("BioCo Phase 2 clinical trial update");
  });

  it("uses clinical trial update when clinical facts are empty of phase/result", () => {
    expect(
      buildSubjectTitle({
        eventCategory: "clinical",
        companyName: "BioCo",
        keyFacts: [{ label: "Source", value: "ClinicalTrials.gov" }],
      }),
    ).toBe("BioCo clinical trial update");
  });

  it("builds regulatory agency + product titles without inventing approval", () => {
    expect(
      buildSubjectTitle({
        eventCategory: "regulatory",
        companyName: "Acme Corp",
        keyFacts: [
          { label: "Outcome", value: "FDA approval" },
          { label: "Product", value: "DrugX" },
        ],
      }),
    ).toBe("Acme Corp wins FDA approval for DrugX");

    expect(
      buildSubjectTitle({
        eventCategory: "regulatory",
        companyName: "Acme Corp",
        keyFacts: [
          { label: "Outcome", value: "Complete Response Letter (CRL)" },
          { label: "Product", value: "DrugX" },
          { label: "Agency", value: "FDA" },
        ],
      }),
    ).toBe("Acme Corp receives FDA CRL for DrugX");

    expect(
      buildSubjectTitle({
        eventCategory: "regulatory",
        companyName: "Acme Corp",
        keyFacts: [{ label: "Form", value: "8-K" }],
      }),
    ).toBe("Acme Corp regulatory update");
  });

  it("builds analyst firm/action/PT titles", () => {
    expect(
      buildSubjectTitle({
        eventCategory: "analyst",
        companyName: "Acme Corp",
        keyFacts: [
          { label: "Firm", value: "Goldman" },
          { label: "Action", value: "upgraded to Buy" },
          { label: "PT", value: "$180" },
        ],
      }),
    ).toBe("Acme Corp: Goldman upgraded to Buy · PT $180");
  });

  it("keeps subject voices distinct across categories", () => {
    const earnings = buildSubjectTitle({
      eventCategory: "earnings",
      companyName: "Acme",
      quarter: 1,
      keyFacts: [{ label: "EPS", value: "$0.50" }],
    });
    const halt = buildSubjectTitle({
      eventCategory: "trading_halt",
      companyName: "Acme",
      haltReason: "News pending",
      keyFacts: [{ label: "Reason", value: "News pending" }],
    });
    const cyber = buildSubjectTitle({
      eventCategory: "cyber",
      companyName: "Acme",
      keyFacts: [{ label: "Incident", value: "ransomware attack" }],
    });
    expect(earnings).toMatch(/earnings|EPS/i);
    expect(halt).toMatch(/^Halts \(/);
    expect(cyber).toMatch(/cyber|ransomware/i);
    expect(new Set([earnings, halt, cyber]).size).toBe(3);
  });

  it("does not invent dollar amounts absent from facts", () => {
    const title = buildSubjectTitle({
      eventCategory: "capital",
      companyName: "Acme Corp",
      symbol: "ACME",
      keyFacts: [
        { label: "Form", value: "S-3" },
        { label: "Type", value: "Shelf registration" },
      ],
    });
    expect(title).not.toMatch(/\$\d/);
    expect(title).toMatch(/shelf registration/i);
  });
});

describe("looksFactEnrichedTitle + preferSubjectTitle", () => {
  it("detects enriched shelf / insider / deal / clinical patterns", () => {
    expect(looksFactEnrichedTitle("ACME — Shelf $500M")).toBe(true);
    expect(
      looksFactEnrichedTitle("Acme Corp files $500M shelf registration"),
    ).toBe(true);
    expect(looksFactEnrichedTitle("Acme Corp insider buy: Jane · $1M")).toBe(
      true,
    );
    expect(
      looksFactEnrichedTitle("Acme Corp to acquire Rival Inc for $2.0B"),
    ).toBe(true);
    expect(
      looksFactEnrichedTitle(
        "BioCo Phase 3 trial meets primary endpoint in NSCLC",
      ),
    ).toBe(true);
    expect(
      looksFactEnrichedTitle("Acme Corp files shelf registration (S-3)"),
    ).toBe(true);
    expect(
      looksFactEnrichedTitle("Acme announces partnership with BioCo"),
    ).toBe(true);
    expect(looksFactEnrichedTitle("Acme Corp - Shelf Registration (S-3)")).toBe(
      false,
    );
  });

  it("prefers enriched subject title over ground-rule chip", () => {
    expect(
      preferSubjectTitle(
        {
          eventCategory: "insider",
          subcategory: "insider_sell",
          companyName: "Acme Corp",
          keyFacts: [
            { label: "Insider", value: "Jane Doe" },
            { label: "Value", value: "$900K" },
            { label: "Direction", value: "Sell" },
          ],
        },
        "Acme Corp insider sale filed",
      ),
    ).toBe("Acme Corp insider sale: Jane Doe · $900K");
  });
});
