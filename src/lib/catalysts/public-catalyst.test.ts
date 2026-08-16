import { describe, expect, it } from "vitest";

import { toPublicFeedCatalyst } from "./public-catalyst";

describe("toPublicFeedCatalyst", () => {
  it("ships case-engine display titles instead of taxonomy chips", () => {
    const pub = toPublicFeedCatalyst({
      id: 1,
      symbol: "AMD",
      companyName: "Advanced Micro Devices",
      type: "8-K",
      title: "AMD - Partnership or Major Contract Announced",
      headline: "Material agreement",
      eventCategory: "deals",
      subcategory: null,
      itemCodes: [{ code: "1.01", label: "Material agreement" }],
      timestamp: "2026-07-26T13:31:00.000Z",
      summary:
        "Advanced Micro Devices entered into a definitive agreement to acquire ZT Systems for $4.9 billion.",
      impactScore: null,
      confidence: null,
      tags: [],
      historicalImpact: null,
      sourceUrl: null,
      sourceProvider: "sec-edgar",
      keyFacts: [
        { label: "Target", value: "ZT Systems" },
        { label: "Deal value", value: "$4.9B" },
        { label: "Status", value: "Agrees to acquire" },
      ],
    });

    expect(pub.title).not.toMatch(/Partnership or Major Contract Announced/i);
    expect(pub.title).toMatch(/Acquire ZT Systems/i);
  });

  it("upgrades thin FDA chip titles on the public feed path", () => {
    const pub = toPublicFeedCatalyst({
      id: 2,
      symbol: "MRK",
      companyName: "Merck & Co.",
      type: "FDA",
      title: "Merck & Co. - Regulatory Action Update",
      headline: "FDA approval update",
      eventCategory: "regulatory",
      subcategory: null,
      timestamp: "2026-07-26T13:36:00.000Z",
      summary: "FDA approved Keytruda for NSCLC.",
      impactScore: null,
      sourceUrl: null,
      keyFacts: [
        { label: "Agency", value: "FDA" },
        { label: "Outcome", value: "Approval" },
        { label: "Product", value: "Keytruda" },
        { label: "Indication", value: "NSCLC" },
      ],
    });

    expect(pub.title).not.toMatch(/Regulatory Action Update/i);
    expect(pub.title).toMatch(/FDA|Approves|Approval/i);
  });
});
