import { describe, expect, it } from "vitest";

import { deliverAlertRules, type AlertCatalystPayload } from "./deliver";

const catalyst: AlertCatalystPayload = {
  id: 1,
  symbol: "NVDA",
  headline: "Earnings / results",
  title: "NVIDIA — 8-K",
  eventCategory: "earnings",
  impactScore: 85,
  timestamp: "2026-07-20T21:00:00.000Z",
  sourceUrl: "https://www.sec.gov/example",
};

describe("deliverAlertRules", () => {
  it("fails push with no subscriptions and a clear message", async () => {
    const results = await deliverAlertRules({
      catalyst,
      force: true,
      rules: [
        {
          id: 1,
          name: "Push rule",
          channel: "push",
          webhookUrl: null,
          emailTo: null,
          telegramChatId: null,
          conditions: {},
        },
      ],
    });
    expect(results[0]).toMatchObject({ channel: "push", ok: false });
    expect(results[0].detail.toLowerCase()).toContain("no push subscriptions");
    expect(results[0].detail.toLowerCase()).toContain("/alerts");
  });

  it("fails telegram rules missing a chat id", async () => {
    const results = await deliverAlertRules({
      catalyst,
      force: true,
      rules: [
        {
          id: 2,
          name: "Telegram rule",
          channel: "telegram",
          webhookUrl: null,
          emailTo: null,
          telegramChatId: null,
          conditions: {},
        },
      ],
    });
    expect(results[0]).toMatchObject({ channel: "telegram", ok: false });
    expect(results[0].detail.toLowerCase()).toContain("missing telegram");
  });

  it("skips when watchlistOnly and symbol not on watchlist", async () => {
    const results = await deliverAlertRules({
      catalyst,
      watchlistSymbols: ["AAPL"],
      rules: [
        {
          id: 3,
          name: "Watchlist bombs",
          channel: "webhook",
          webhookUrl: "https://example.com/hook",
          emailTo: null,
          telegramChatId: null,
          conditions: { watchlistOnly: true },
        },
      ],
    });
    expect(results[0].skipped).toBe(true);
  });

  it("skips when watchlistIds set and catalyst misses every criteria", async () => {
    const results = await deliverAlertRules({
      catalyst,
      watchlistCriteriaById: new Map([
        [10, { symbols: ["AAPL"], tags: ["impact:high"] }],
      ]),
      rules: [
        {
          id: 5,
          name: "Saved watchlist bombs",
          channel: "webhook",
          webhookUrl: "https://example.com/hook",
          emailTo: null,
          telegramChatId: null,
          conditions: { watchlistIds: [10] },
        },
      ],
    });
    expect(results[0].skipped).toBe(true);
  });

  it("matches when catalyst hits any selected watchlist criteria", async () => {
    const results = await deliverAlertRules({
      catalyst: { ...catalyst, tags: ["impact:high"] },
      watchlistCriteriaById: new Map([
        [10, { symbols: ["AAPL"] }],
        [11, { symbols: ["NVDA"], tags: ["impact:high"] }],
      ]),
      rules: [
        {
          id: 6,
          name: "Multi watchlist",
          channel: "push",
          webhookUrl: null,
          emailTo: null,
          telegramChatId: null,
          conditions: { watchlistIds: [10, 11] },
        },
      ],
    });
    // Conditions matched (not skipped); push fails with no subscriptions.
    expect(results[0].skipped).toBeFalsy();
    expect(results[0].ok).toBe(false);
    expect(results[0].detail.toLowerCase()).toContain("no push subscriptions");
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
          telegramChatId: null,
          conditions: {},
        },
      ],
    });
    expect(results[0].ok).toBe(false);
    expect(results[0].detail.toLowerCase()).toMatch(/private|local|metadata/);
  });
});
