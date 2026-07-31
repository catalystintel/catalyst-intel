import { NextResponse, type NextRequest } from "next/server";

import { sendTelegramMessage } from "@/lib/telegram/bot";

/**
 * Telegram webhook target. Register once (after deploying, HTTPS required)
 * with:
 *
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-domain>/api/telegram/webhook"
 *
 * When a user messages the bot (e.g. /start), we reply with their chat_id so
 * they can paste it into an alert rule — no account linking required for
 * this MVP. Always returns 200 so Telegram doesn't retry/disable the hook.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message =
    typeof body === "object" && body !== null
      ? (body as { message?: { chat?: { id?: number | string } } }).message
      : undefined;
  const chatId = message?.chat?.id;

  if (chatId !== undefined) {
    await sendTelegramMessage({
      chatId: String(chatId),
      text: [
        "Catalyst Intel bot connected.",
        `Your chat ID: ${chatId}`,
        "",
        "Paste that chat ID into a Telegram alert rule at /alerts to start receiving fires here.",
      ].join("\n"),
    });
  }

  return NextResponse.json({ ok: true });
}
