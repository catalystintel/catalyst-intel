import { describe, expect, it } from "vitest";

import {
  buildSubjectTitle,
  looksFactEnrichedTitle,
  looksProfessionalThinTitle,
  looksTaxonomyChipTitle,
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

  it("falls back to professional thin deal / partnership voices", () => {
    expect(
      buildSubjectTitle({
        eventCategory: "deals",
        companyName: "Acme Corp",
        keyFacts: [{ label: "Type", value: "Material agreement" }],
      }),
    ).toBe("Acme Corp - Partnership or Major Contract Announced");

    expect(
      buildSubjectTitle({
        eventCategory: "deals",
        companyName: "Acme Corp",
        keyFacts: [
          { label: "Type", value: "Partnership" },
          { label: "Partner", value: "partnership" },
        ],
      }),
    ).toBe("Acme Corp - Strategic Partnership Announced");

    expect(
      buildSubjectTitle({
        eventCategory: "deals",
        companyName: "Acme Corp",
        title: "Acme Corp acquisition filing",
        keyFacts: [{ label: "Type", value: "Acquisition" }],
      }),
    ).toBe("Acme Corp - Acquisition Announced (Deal in Play)");
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

  it("uses professional thin capital fallbacks without inventing size", () => {
    expect(
      buildSubjectTitle({
        eventCategory: "capital",
        companyName: "Acme Corp",
        keyFacts: [
          { label: "Form", value: "S-3" },
          { label: "Type", value: "Shelf registration" },
        ],
      }),
    ).toBe("Acme Corp - Shelf Registration Filed (Capital Raise Window)");

    expect(
      buildSubjectTitle({
        eventCategory: "capital",
        companyName: "Acme Corp",
        keyFacts: [
          { label: "Form", value: "424B5" },
          { label: "Type", value: "Prospectus supplement" },
        ],
      }),
    ).toBe("Acme Corp - Stock Offering Filed (Dilution Ahead)");
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

  it("uses clinical trial results thin voice when phase/result missing", () => {
    expect(
      buildSubjectTitle({
        eventCategory: "clinical",
        companyName: "BioCo",
        keyFacts: [{ label: "Source", value: "ClinicalTrials.gov" }],
      }),
    ).toBe("BioCo - Clinical Trial Results Update");

    expect(
      buildSubjectTitle({
        eventCategory: "clinical",
        companyName: "BioCo",
      }),
    ).toBe("BioCo - Clinical Trial Results Update");
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
    ).toBe("Acme Corp - Regulatory Action Update");

    expect(
      buildSubjectTitle({
        eventCategory: "regulatory",
        companyName: "Acme Corp",
      }),
    ).toBe("Acme Corp - Regulatory Action Update");
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
    expect(title).toMatch(/Shelf Registration Filed/i);
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
    // Bare shelf/offering sentences without $ are not fact-enriched.
    expect(
      looksFactEnrichedTitle("Acme Corp files shelf registration (S-3)"),
    ).toBe(false);
    expect(
      looksFactEnrichedTitle(
        "Acme Corp - Shelf Registration Filed (Capital Raise Window)",
      ),
    ).toBe(false);
    expect(
      looksFactEnrichedTitle("Acme announces partnership with BioCo"),
    ).toBe(true);
    expect(looksFactEnrichedTitle("Acme Corp - Shelf Registration (S-3)")).toBe(
      false,
    );
  });

  it("recognizes professional thin and taxonomy chip titles", () => {
    expect(
      looksProfessionalThinTitle(
        "Acme Corp - Shelf Registration Filed (Capital Raise Window)",
      ),
    ).toBe(true);
    expect(
      looksProfessionalThinTitle(
        "Acme Corp - Acquisition Announced (Deal in Play)",
      ),
    ).toBe(true);
    expect(looksTaxonomyChipTitle("Shelf registration (S-3)")).toBe(true);
    expect(looksTaxonomyChipTitle("8-K filing")).toBe(true);
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

  it("upgrades taxonomy chips and legacy stiff voices to professional thin", () => {
    expect(
      preferSubjectTitle(
        {
          eventCategory: "capital",
          companyName: "Acme Corp",
          keyFacts: [
            { label: "Form", value: "S-3" },
            { label: "Type", value: "Shelf registration" },
          ],
        },
        "Shelf registration (S-3)",
      ),
    ).toBe("Acme Corp - Shelf Registration Filed (Capital Raise Window)");

    expect(
      preferSubjectTitle(
        {
          eventCategory: "deals",
          companyName: "Acme Corp",
          keyFacts: [{ label: "Type", value: "Material agreement" }],
        },
        "Acme Corp - New Deal Announced (Major Contract or Partnership)",
      ),
    ).toBe("Acme Corp - Partnership or Major Contract Announced");

    expect(
      preferSubjectTitle(
        {
          eventCategory: "clinical",
          companyName: "BioCo",
        },
        "BioCo clinical trial update",
      ),
    ).toBe("BioCo - Clinical Trial Results Update");
  });

  it("does not overwrite a specific study headline with thin clinical voice", () => {
    expect(
      preferSubjectTitle(
        {
          eventCategory: "clinical",
          companyName: "BioCo",
          title:
            "BioCo reports positive topline data from Phase 3 KEYNOTE study",
        },
        "BioCo reports positive topline data from Phase 3 KEYNOTE study",
      ),
    ).toBe("BioCo reports positive topline data from Phase 3 KEYNOTE study");
  });

  it("builds titles from fetch type/items/summary without keyFacts", () => {
    expect(
      buildSubjectTitle({
        eventCategory: "capital",
        companyName: "Acme Corp",
        type: "S-3",
        keyFacts: [],
      }),
    ).toBe("Acme Corp - Shelf Registration Filed (Capital Raise Window)");

    expect(
      buildSubjectTitle({
        eventCategory: "capital",
        companyName: "Acme Corp",
        type: "S-3",
        summary:
          "The company filed a shelf registration for up to $500 million.",
        keyFacts: [],
      }),
    ).toBe("Acme Corp files $500 million shelf registration");

    expect(
      buildSubjectTitle({
        eventCategory: "deals",
        companyName: "Acme Corp",
        type: "8-K",
        items: [
          { code: "1.01", label: "Entry into a Material Definitive Agreement" },
        ],
        summary: "Acme announced a strategic partnership with BioCo.",
        keyFacts: [],
      }),
    ).toMatch(/partnership/i);

    expect(
      buildSubjectTitle({
        eventCategory: "clinical",
        companyName: "BioCo",
        type: "Clinical Trial",
        summary: "Phase 3 trial met the primary endpoint in NSCLC patients.",
        keyFacts: [],
      }),
    ).toMatch(/Phase 3/i);

    expect(
      buildSubjectTitle({
        eventCategory: "regulatory",
        companyName: "Acme Corp",
        type: "8-K",
        summary: "FDA approved DrugX for the treatment of adults.",
        keyFacts: [],
      }),
    ).toMatch(/FDA|approv/i);
  });
});
