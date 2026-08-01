import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildTelegramInboundReply,
  escapeTelegramHtml,
  getTelegramBotUsername,
  isTelegramConfigured,
  isValidTelegramWebhookSecret,
  normalizeTelegramCommand,
  parseTelegramCommand,
  sendTelegramMessage,
  setupTelegramBot,
  telegramWelcomeReply,
} from "./bot";

const originalToken = process.env.TELEGRAM_BOT_TOKEN;
const originalWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const originalPublicUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
const originalUsername = process.env.TELEGRAM_BOT_USERNAME;

afterEach(() => {
  if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = originalToken;
  if (originalWebhookSecret === undefined) {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
  } else {
    process.env.TELEGRAM_WEBHOOK_SECRET = originalWebhookSecret;
  }
  if (originalPublicUsername === undefined) {
    delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  } else {
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = originalPublicUsername;
  }
  if (originalUsername === undefined) delete process.env.TELEGRAM_BOT_USERNAME;
  else process.env.TELEGRAM_BOT_USERNAME = originalUsername;
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

describe("getTelegramBotUsername", () => {
  it("prefers NEXT_PUBLIC_ and strips @", () => {
    delete process.env.TELEGRAM_BOT_USERNAME;
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = "@CatalystIntelBot";
    expect(getTelegramBotUsername()).toBe("CatalystIntelBot");
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

describe("parseTelegramCommand", () => {
  it("parses /start and /start@BotName", () => {
    expect(parseTelegramCommand("/start")).toEqual({
      command: "start",
      args: "",
    });
    expect(parseTelegramCommand("/start@CatalystIntelBot")).toEqual({
      command: "start",
      args: "",
    });
    expect(parseTelegramCommand("/id  extra")).toEqual({
      command: "id",
      args: "extra",
    });
    expect(parseTelegramCommand("hi")).toBeNull();
  });

  it("normalizes command tokens", () => {
    expect(normalizeTelegramCommand("/HELP@Bot")).toBe("help");
  });
});

describe("inbound replies", () => {
  it("includes a copyable chat id for /start", () => {
    const reply = buildTelegramInboundReply({
      chatId: 42,
      text: "/start",
    });
    expect(reply.parseMode).toBe("HTML");
    expect(reply.text).toContain("<code>42</code>");
    expect(reply.text.toLowerCase()).toContain("chat id");
  });

  it("returns id-focused copy for /id", () => {
    const reply = buildTelegramInboundReply({ chatId: 99, text: "/id" });
    expect(reply.text).toContain("<code>99</code>");
    expect(reply.text).toContain("Your Telegram chat ID");
  });

  it("returns help for /help", () => {
    const reply = buildTelegramInboundReply({ chatId: 7, text: "/help" });
    expect(reply.text).toContain("How Telegram alerts work");
    expect(reply.text).toContain("<code>7</code>");
  });

  it("still returns chat id for plain text", () => {
    const reply = buildTelegramInboundReply({ chatId: 5, text: "hello" });
    expect(reply.text).toBe(telegramWelcomeReply(5));
  });

  it("escapes HTML in chat ids that somehow contain markup", () => {
    expect(escapeTelegramHtml("a<b>&c")).toBe("a&lt;b&gt;&amp;c");
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
    expect(result.detail.toLowerCase()).toContain("not available");
  });

  it("fails when chat id is missing", async () => {
    const result = await sendTelegramMessage({ chatId: "  ", text: "hi" });
    expect(result.ok).toBe(false);
    expect(result.detail.toLowerCase()).toContain("chat id");
  });

  it("sends via the Telegram Bot API with optional parse_mode", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response('{"ok":true,"result":{}}', { status: 200 }),
      );

    const result = await sendTelegramMessage({
      chatId: "42",
      text: "<b>hi</b>",
      parseMode: "HTML",
    });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bot123:abc/sendMessage",
      expect.objectContaining({ method: "POST" }),
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      chat_id: "42",
      parse_mode: "HTML",
    });
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

describe("setupTelegramBot", () => {
  it("fails closed without token or secret", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const report = await setupTelegramBot({
      webhookUrl: "https://example.com/api/telegram/webhook",
    });
    expect(report.ok).toBe(false);
  });

  it("registers webhook, commands, descriptions, and photo", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:abc";
    process.env.TELEGRAM_WEBHOOK_SECRET = "hook-secret";

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.endsWith("/setMyProfilePhoto")) {
          return new Response('{"ok":true,"result":true}', { status: 200 });
        }
        if (url.endsWith("/getMe")) {
          return new Response(
            JSON.stringify({
              ok: true,
              result: {
                id: 1,
                username: "CatalystIntelBot",
                first_name: "Catalyst Intel",
              },
            }),
            { status: 200 },
          );
        }
        return new Response('{"ok":true,"result":true}', { status: 200 });
      });

    const report = await setupTelegramBot({
      webhookUrl: "https://example.com/api/telegram/webhook",
    });

    expect(report.ok).toBe(true);
    expect(report.bot?.username).toBe("CatalystIntelBot");
    expect(report.steps.setWebhook?.ok).toBe(true);
    expect(report.steps.setMyCommands?.ok).toBe(true);
    expect(report.steps.setMyProfilePhoto?.ok).toBe(true);

    const methods = fetchMock.mock.calls.map((c) =>
      String(c[0]).split("/").pop(),
    );
    expect(methods).toContain("setWebhook");
    expect(methods).toContain("setMyCommands");
    expect(methods).toContain("setMyProfilePhoto");
  });
});
