import { describe, expect, it } from "vitest";

import { deliverAlertRules, type AlertCatalystPayload } from "./deliver";

const catalyst: AlertCatalystPayload = {
  id: 1,
  ticker: "NVDA",
  headline: "Earnings / results",
  title: "NVIDIA — 8-K",
  eventCategory: "earnings",
  impactScore: 85,
  timestamp: "2026-07-20T21:00:00.000Z",
  sourceUrl: "https://www.sec.gov/example",
};

describe("deliverAlertRules", () => {
  it("skips push with coming-soon message", async () => {
    const results = await deliverAlertRules({
      catalyst,
      force: true,
      rules: [
        {
          id: 1,
          name: "Push stub",
          channel: "push",
          webhookUrl: null,
          emailTo: null,
          conditions: {},
        },
      ],
    });
    expect(results[0]).toMatchObject({
      channel: "push",
      skipped: true,
    });
    expect(results[0].detail.toLowerCase()).toContain("coming soon");
  });

  it("skips when watchlistOnly and ticker not on watchlist", async () => {
    const results = await deliverAlertRules({
      catalyst,
      watchlistTickers: ["AAPL"],
      rules: [
        {
          id: 3,
          name: "Watchlist bombs",
          channel: "webhook",
          webhookUrl: "https://example.com/hook",
          emailTo: null,
          conditions: { watchlistOnly: true, minImpact: 70 },
        },
      ],
    });
    expect(results[0].skipped).toBe(true);
  });

  it("rejects private webhook URLs (SSRF guard)", async () => {
    const results = await deliverAlertRules({
      catalyst,
      force: true,
      rules: [
        {
          id: 4,
          name: "Bad hook",
          channel: "webhook",
          webhookUrl: "https://127.0.0.1/hook",
          emailTo: null,
          conditions: {},
        },
      ],
    });
    expect(results[0].ok).toBe(false);
    expect(results[0].detail.toLowerCase()).toMatch(/private|local|metadata/);
  });
});
