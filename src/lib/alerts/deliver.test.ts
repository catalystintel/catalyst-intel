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
          telegramChatId: null,
          conditions: {},
        },
      ],
    });
    expect(results[0].ok).toBe(false);
    expect(results[0].detail.toLowerCase()).toMatch(/private|local|metadata/);
  });
});
