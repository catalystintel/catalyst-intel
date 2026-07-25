import { describe, expect, it } from "vitest";

import { parseTriageResponse } from "./llm-triage";

describe("parseTriageResponse", () => {
  it("parses clean JSON", () => {
    const result = parseTriageResponse(
      JSON.stringify({
        bullets: ["Revenue beat consensus", "Guidance raised for FY"],
        lean: "bullish",
        uncertain: false,
      }),
    );
    expect(result).toEqual({
      bullets: ["Revenue beat consensus", "Guidance raised for FY"],
      lean: "bullish",
      uncertain: false,
    });
  });

  it("strips markdown fences from free-model replies", () => {
    const result = parseTriageResponse(`\`\`\`json
{"bullets":["Board approved buyback"],"lean":"neutral","uncertain":true}
\`\`\``);
    expect(result?.bullets).toEqual(["Board approved buyback"]);
    expect(result?.lean).toBe("neutral");
    expect(result?.uncertain).toBe(true);
  });

  it("caps at 3 bullets and defaults bad lean", () => {
    const result = parseTriageResponse(
      JSON.stringify({
        bullets: ["a", "b", "c", "d"],
        lean: "moon",
      }),
    );
    expect(result?.bullets).toEqual(["a", "b", "c"]);
    expect(result?.lean).toBe("uncertain");
    expect(result?.uncertain).toBe(true);
  });

  it("returns null when bullets are missing", () => {
    expect(parseTriageResponse("{}")).toBeNull();
    expect(parseTriageResponse("not json")).toBeNull();
  });
});
