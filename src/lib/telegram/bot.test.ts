import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildAlertInlineKeyboard,
  clearTelegramBotIdentityCache,
  escapeTelegramHtml,
  getTelegramBotUsername,
  isTelegramConfigured,
  isValidTelegramWebhookSecret,
  MAIN_REPLY_KEYBOARD,
  normalizeTelegramCommand,
  parseTelegramCommand,
  resolveTelegramBotIdentity,
  sendTelegramMessage,
  setupTelegramBot,
  TELEGRAM_BOT_COMMANDS,
} from "./bot";
import {
  telegramChatIdReply,
  telegramHelpReply,
  telegramWelcomeReply,
} from "./handlers";

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
  clearTelegramBotIdentityCache();
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

describe("resolveTelegramBotIdentity", () => {
  it("falls back to env username when token is missing", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = "EnvBot";
    const identity = await resolveTelegramBotIdentity();
    expect(identity).toMatchObject({
      username: "EnvBot",
      handle: "@EnvBot",
      deepLink: "https://t.me/EnvBot",
    });
  });

  it("uses getMe username so the desk can show the live @handle", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:abc";
    delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
    delete process.env.TELEGRAM_BOT_USERNAME;

    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          result: {
            id: 1,
            username: "LiveCatalystBot",
            first_name: "Catalyst Intel",
          },
        }),
        { status: 200 },
      ),
    );

    const identity = await resolveTelegramBotIdentity();
    expect(identity.handle).toBe("@LiveCatalystBot");
    expect(identity.firstName).toBe("Catalyst Intel");
    expect(identity.deepLink).toBe("https://t.me/LiveCatalystBot");

    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockClear();
    const again = await resolveTelegramBotIdentity();
    expect(again.handle).toBe("@LiveCatalystBot");
    expect(fetchMock).not.toHaveBeenCalled();
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
    expect(parseTelegramCommand("/start tok_abc")).toEqual({
      command: "start",
      args: "tok_abc",
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

describe("commands and keyboards", () => {
  it("registers status/recent/mute commands", () => {
    const names = TELEGRAM_BOT_COMMANDS.map((c) => c.command);
    expect(names).toEqual(
      expect.arrayContaining([
        "start",
        "status",
        "recent",
        "mute",
        "unmute",
        "id",
        "help",
      ]),
    );
  });

  it("builds alert inline keyboard with open + mute", () => {
    const kb = buildAlertInlineKeyboard({
      deskUrl: "https://app.example/catalyst-feed/catalyst/1",
      watchlistsUrl: "https://app.example/watchlist",
    });
    expect(kb.inline_keyboard[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: "Open event" }),
        expect.objectContaining({ text: "Watchlist" }),
      ]),
    );
    expect(kb.inline_keyboard.at(-1)).toEqual([
      { text: "Mute 1h", callback_data: "mute:1h" },
    ]);
  });

  it("exposes a persistent reply keyboard", () => {
    expect(MAIN_REPLY_KEYBOARD.keyboard.length).toBeGreaterThanOrEqual(2);
  });
});

describe("inbound replies", () => {
  it("includes menu copy for /start", () => {
    const reply = telegramWelcomeReply({ chatId: 42 });
    expect(reply.parseMode).toBe("HTML");
    expect(reply.text).toContain("Catalyst Intel");
    expect(reply.replyMarkup).toEqual(MAIN_REPLY_KEYBOARD);
  });

  it("returns id-focused copy for /id", () => {
    const reply = telegramChatIdReply(99);
    expect(reply.text).toContain("<code>99</code>");
    expect(reply.text).toContain("Your Telegram chat ID");
  });

  it("returns help for /help", () => {
    const reply = telegramHelpReply(7);
    expect(reply.text).toContain("How Telegram alerts work");
    expect(reply.text).toContain("<code>7</code>");
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
  });

  it("rejects blank chat ids", async () => {
    const result = await sendTelegramMessage({ chatId: "  ", text: "hi" });
    expect(result.ok).toBe(false);
    expect(result.detail.toLowerCase()).toContain("chat");
  });

  it("sends via the Telegram Bot API with optional parse_mode", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 }),
      );

    const result = await sendTelegramMessage({
      chatId: "42",
      text: "<b>hi</b>",
      parseMode: "HTML",
      replyMarkup: MAIN_REPLY_KEYBOARD,
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/bot123:abc/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"reply_markup"'),
      }),
    );
  });

  it("surfaces Telegram API errors", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false, description: "Forbidden" }), {
        status: 200,
      }),
    );
    const result = await sendTelegramMessage({ chatId: "42", text: "hi" });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("Forbidden");
  });
});

describe("setupTelegramBot", () => {
  it("fails closed when webhook secret is missing", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:abc";
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const report = await setupTelegramBot({
      webhookUrl: "https://example.com/api/telegram/webhook",
    });
    expect(report.ok).toBe(false);
    expect(report.steps.secret?.ok).toBe(false);
  });

  it("registers webhook with callback_query updates", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:abc";
    process.env.TELEGRAM_WEBHOOK_SECRET = "hook-secret";

    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.endsWith("/getMe")) {
          return new Response(
            JSON.stringify({
              ok: true,
              result: { id: 1, username: "Bot", first_name: "Bot" },
            }),
            { status: 200 },
          );
        }
        if (url.endsWith("/setWebhook")) {
          return new Response(JSON.stringify({ ok: true, result: true }), {
            status: 200,
          });
        }
        if (url.endsWith("/setMyCommands")) {
          return new Response(JSON.stringify({ ok: true, result: true }), {
            status: 200,
          });
        }
        if (
          url.endsWith("/setMyDescription") ||
          url.endsWith("/setMyShortDescription")
        ) {
          return new Response(JSON.stringify({ ok: true, result: true }), {
            status: 200,
          });
        }
        // profile photo upload
        return new Response(JSON.stringify({ ok: true, result: true }), {
          status: 200,
        });
      });

    const report = await setupTelegramBot({
      webhookUrl: "https://example.com/api/telegram/webhook",
    });

    expect(report.steps.setWebhook?.ok).toBe(true);
    const webhookCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).endsWith("/setWebhook"),
    );
    expect(webhookCall).toBeTruthy();
    const body = JSON.parse(String(webhookCall?.[1]?.body ?? "{}")) as {
      allowed_updates?: string[];
    };
    expect(body.allowed_updates).toEqual(
      expect.arrayContaining(["message", "callback_query"]),
    );
  });
});
