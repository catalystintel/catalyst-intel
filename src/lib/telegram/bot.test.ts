import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isTelegramConfigured,
  isValidTelegramWebhookSecret,
  sendTelegramMessage,
} from "./bot";

const originalToken = process.env.TELEGRAM_BOT_TOKEN;
const originalWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

afterEach(() => {
  if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = originalToken;
  if (originalWebhookSecret === undefined) {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
  } else {
    process.env.TELEGRAM_WEBHOOK_SECRET = originalWebhookSecret;
  }
  vi.restoreAllMocks();
});

describe("isTelegramConfigured", () => {
  it("reflects TELEGRAM_BOT_TOKEN presence", () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    expect(isTelegramConfigured()).toBe(false);
    process.env.TELEGRAM_BOT_TOKEN = "123:abc";
    expect(isTelegramConfigured()).toBe(true);
  });
});

describe("isValidTelegramWebhookSecret", () => {
  it("fails closed when secret is unset", () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    expect(isValidTelegramWebhookSecret("anything")).toBe(false);
    expect(isValidTelegramWebhookSecret(null)).toBe(false);
  });

  it("accepts a matching secret token", () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "hook-secret";
    expect(isValidTelegramWebhookSecret("hook-secret")).toBe(true);
    expect(isValidTelegramWebhookSecret("wrong")).toBe(false);
  });
});

describe("sendTelegramMessage", () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = "123:abc";
  });

  it("fails clearly when unconfigured", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const result = await sendTelegramMessage({ chatId: "1", text: "hi" });
    expect(result.ok).toBe(false);
    expect(result.detail.toLowerCase()).toContain("telegram_bot_token");
  });

  it("fails when chat id is missing", async () => {
    const result = await sendTelegramMessage({ chatId: "  ", text: "hi" });
    expect(result.ok).toBe(false);
    expect(result.detail.toLowerCase()).toContain("chat id");
  });

  it("sends via the Telegram Bot API", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    const result = await sendTelegramMessage({ chatId: "42", text: "hi" });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bot123:abc/sendMessage",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("reports non-2xx responses", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("bad chat", { status: 400 }),
    );
    const result = await sendTelegramMessage({ chatId: "42", text: "hi" });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("400");
  });
});
