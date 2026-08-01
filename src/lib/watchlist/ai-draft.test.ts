import { describe, expect, it } from "vitest";

import { parseWatchlistDraftResponse } from "./ai-draft";

describe("parseWatchlistDraftResponse", () => {
  it("parses clean JSON into a normalized draft", () => {
    const draft = parseWatchlistDraftResponse(
      JSON.stringify({
        name: "Biotech FDA catalysts",
        rationale: "Clinical/regulatory events tagged fda.",
        criteria: { categories: ["clinical", "regulatory"], tags: ["FDA"] },
      }),
    );
    expect(draft).toEqual({
      name: "Biotech FDA catalysts",
      rationale: "Clinical/regulatory events tagged fda.",
      criteria: { categories: ["clinical", "regulatory"], tags: ["fda"] },
    });
  });

  it("strips markdown fences from free-model replies", () => {
    const draft = parseWatchlistDraftResponse(`\`\`\`json
{"name":"Insider buys","rationale":"Form 4 insider transactions.","criteria":{"forms":["4"],"categories":["insider"]}}
\`\`\``);
    expect(draft?.name).toBe("Insider buys");
    expect(draft?.criteria).toEqual({ forms: ["4"], categories: ["insider"] });
  });

  it("drops unknown category/form values via normalization", () => {
    const draft = parseWatchlistDraftResponse(
      JSON.stringify({
        name: "Bad rule",
        criteria: { categories: ["not-a-real-category"], symbols: ["nvda"] },
      }),
    );
    expect(draft?.criteria).toEqual({ symbols: ["NVDA"] });
  });

  it("returns null when criteria is empty or missing", () => {
    expect(parseWatchlistDraftResponse("{}")).toBeNull();
    expect(
      parseWatchlistDraftResponse(JSON.stringify({ name: "x", criteria: {} })),
    ).toBeNull();
    expect(parseWatchlistDraftResponse("not json")).toBeNull();
  });

  it("defaults name and rationale when missing", () => {
    const draft = parseWatchlistDraftResponse(
      JSON.stringify({ criteria: { symbols: ["TSLA"] } }),
    );
    expect(draft?.name).toBe("AI-drafted watchlist");
    expect(draft?.rationale).toBe("");
  });
});
