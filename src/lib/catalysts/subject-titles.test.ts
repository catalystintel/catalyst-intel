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

  it("builds deal titles with value and target", () => {
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

  it("builds capital shelf titles with amount", () => {
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
    ).toBe("ACME — Shelf $500M");
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

  it("builds clinical phase/status titles", () => {
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
    ).toBe("BioCo Phase 3 met primary endpoint in NSCLC");
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
  it("detects enriched shelf / insider patterns", () => {
    expect(looksFactEnrichedTitle("ACME — Shelf $500M")).toBe(true);
    expect(looksFactEnrichedTitle("Acme Corp insider buy: Jane · $1M")).toBe(
      true,
    );
    expect(
      looksFactEnrichedTitle("Acme Corp files shelf registration (S-3)"),
    ).toBe(false);
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
