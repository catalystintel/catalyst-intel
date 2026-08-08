import { describe, expect, it } from "vitest";

import { resolveAlertTakeaway } from "./takeaway";

describe("resolveAlertTakeaway", () => {
  it("prefers the first cached AI bullet", () => {
    expect(
      resolveAlertTakeaway({
        aiBullets: ["  Guidance cut.  ", "Second"],
        summary: "Company reported inventory build.",
        headline: "NVDA guides down",
      }),
    ).toBe("Guidance cut.");
  });

  it("falls back to deterministic WIIM from summary", () => {
    const takeaway = resolveAlertTakeaway({
      aiBullets: null,
      summary:
        "The company beat estimates on revenue. Management raised full-year guidance.",
      headline: "Earnings",
      title: "Earnings",
    });
    expect(takeaway).toBeTruthy();
  });
});
