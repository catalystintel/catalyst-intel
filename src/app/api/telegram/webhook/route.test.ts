import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const sendTelegramMessage = vi.fn();
const isValidTelegramWebhookSecret = vi.fn();
const buildTelegramMessageReply = vi.fn();
const handleTelegramCallback = vi.fn();

vi.mock("@/lib/telegram/bot", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/telegram/bot")>(
      "@/lib/telegram/bot",
    );
  return {
    ...actual,
    sendTelegramMessage: (...args: unknown[]) => sendTelegramMessage(...args),
    isValidTelegramWebhookSecret: (...args: unknown[]) =>
      isValidTelegramWebhookSecret(...args),
  };
});

vi.mock("@/lib/telegram/handlers", () => ({
  buildTelegramMessageReply: (...args: unknown[]) =>
    buildTelegramMessageReply(...args),
  handleTelegramCallback: (...args: unknown[]) =>
    handleTelegramCallback(...args),
}));

describe("POST /api/telegram/webhook", () => {
  beforeEach(() => {
    sendTelegramMessage.mockReset();
    isValidTelegramWebhookSecret.mockReset();
    buildTelegramMessageReply.mockReset();
    handleTelegramCallback.mockReset();
    isValidTelegramWebhookSecret.mockReturnValue(true);
    sendTelegramMessage.mockResolvedValue({ ok: true, detail: "sent" });
    buildTelegramMessageReply.mockResolvedValue({
      text: "<b>Catalyst Intel</b>\n<code>4242</code>",
      parseMode: "HTML",
      disableWebPagePreview: true,
    });
    handleTelegramCallback.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("rejects bad secrets", async () => {
    isValidTelegramWebhookSecret.mockReturnValue(false);
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/telegram/webhook", {
        method: "POST",
        body: JSON.stringify({ message: { chat: { id: 1 }, text: "/start" } }),
      }),
    );
    expect(res.status).toBe(401);
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("replies via handlers on /start", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/telegram/webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: { chat: { id: 4242 }, text: "/start" },
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(buildTelegramMessageReply).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: "4242", text: "/start" }),
    );
    expect(sendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "4242",
        parseMode: "HTML",
        text: expect.stringContaining("<code>4242</code>"),
      }),
    );
  });

  it("handles /id with a focused reply", async () => {
    buildTelegramMessageReply.mockResolvedValue({
      text: "Your Telegram chat ID\n<code>9</code>",
      parseMode: "HTML",
    });
    const { POST } = await import("./route");
    await POST(
      new NextRequest("http://localhost/api/telegram/webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: { chat: { id: 9 }, text: "/id" },
        }),
      }),
    );
    expect(buildTelegramMessageReply).toHaveBeenCalledWith(
      expect.objectContaining({ text: "/id" }),
    );
  });

  it("routes callback_query to mute handler", async () => {
    const { POST } = await import("./route");
    await POST(
      new NextRequest("http://localhost/api/telegram/webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          callback_query: {
            id: "cb1",
            data: "mute:1h",
            message: { chat: { id: 55 } },
          },
        }),
      }),
    );
    expect(handleTelegramCallback).toHaveBeenCalledWith({
      callbackQueryId: "cb1",
      chatId: "55",
      data: "mute:1h",
    });
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });
});
