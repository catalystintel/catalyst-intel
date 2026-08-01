import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const sendTelegramMessage = vi.fn();
const isValidTelegramWebhookSecret = vi.fn();

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

describe("POST /api/telegram/webhook", () => {
  beforeEach(() => {
    sendTelegramMessage.mockReset();
    isValidTelegramWebhookSecret.mockReset();
    isValidTelegramWebhookSecret.mockReturnValue(true);
    sendTelegramMessage.mockResolvedValue({ ok: true, detail: "sent" });
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

  it("replies with the chat id on /start", async () => {
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
    expect(sendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "4242",
        parseMode: "HTML",
        text: expect.stringContaining("<code>4242</code>"),
      }),
    );
  });

  it("handles /id with a focused reply", async () => {
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
    expect(sendTelegramMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Your Telegram chat ID"),
      }),
    );
  });
});
