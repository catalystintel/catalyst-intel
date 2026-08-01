import { describe, expect, it } from "vitest";

import {
  formatAlertMessage,
  formatSessionsForDisplay,
  sessionsFromSelection,
} from "./format-message";

const catalyst = {
  id: 42,
  symbol: "nvda",
  headline: "8-K Item 8.01 — Other Events",
  title: "NVIDIA CORP — 8-K",
  eventCategory: "disclosure",
  impactScore: 88,
  timestamp: "2026-07-20T21:00:00.000Z",
  sourceUrl: "https://www.sec.gov/example",
};

describe("formatAlertMessage", () => {
  it("builds scannable professional copy with desk deep link", () => {
    const message = formatAlertMessage(catalyst, {
      ruleName: "AH/PM bombs",
      env: { NEXT_PUBLIC_APP_URL: "https://app.example" },
    });

    expect(message.symbol).toBe("NVDA");
    expect(message.subject).toContain("NVDA");
    expect(message.subject).toContain("8-K Item 8.01");
    expect(message.pushTitle).toBe("NVDA · Disclosure");
    expect(message.pushBody).toBe("8-K Item 8.01 — Other Events");
    expect(message.deskUrl).toBe(
      "https://app.example/catalyst-feed/catalyst/42",
    );
    expect(message.text).toContain("NVDA · Disclosure");
    expect(message.text).toContain("Disclosure");
    expect(message.text).toContain("After-hours");
    expect(message.text).not.toMatch(/impact/i);
    expect(message.text).toContain("Rule: AH/PM bombs");
    expect(message.text).toContain("Open on desk:");
    expect(message.text).toContain("Original source:");
    expect(message.text).not.toMatch(/🔔|🔥|🚀/);
  });
});

describe("sessionsFromSelection", () => {
  it("stores any when all buckets selected", () => {
    expect(sessionsFromSelection(["PM", "RTH", "AH"])).toEqual(["any"]);
  });

  it("keeps a subset in session-option order", () => {
    expect(sessionsFromSelection(["AH", "PM"])).toEqual(["PM", "AH"]);
  });
});

describe("formatSessionsForDisplay", () => {
  it("labels buckets for the rule list", () => {
    expect(formatSessionsForDisplay(["AH", "PM"])).toBe(
      "Pre-market · After-hours",
    );
    expect(formatSessionsForDisplay(["any"])).toBe("Any session");
    expect(formatSessionsForDisplay(undefined)).toBe("Any session");
  });
});
