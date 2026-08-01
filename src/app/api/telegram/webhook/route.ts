import { NextResponse, type NextRequest } from "next/server";

import {
  isValidTelegramWebhookSecret,
  sendTelegramMessage,
} from "@/lib/telegram/bot";

/**
 * Telegram webhook target. Register once (after deploying, HTTPS required)
 * with a secret_token that matches TELEGRAM_WEBHOOK_SECRET:
 *
 *   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
 *     -H "Content-Type: application/json" \
 *     -d '{"url":"https://<your-domain>/api/telegram/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
 *
 * When a user messages the bot (e.g. /start), we reply with their chat_id so
 * they can paste it into an alert rule — no account linking required for
 * this MVP. Always returns 200 for authenticated updates so Telegram doesn't
 * retry/disable the hook; unauthenticated requests get 401.
 */
export async function POST(request: NextRequest) {
  const provided = request.headers.get("x-telegram-bot-api-secret-token");
  if (!isValidTelegramWebhookSecret(provided)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

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
        "Catalyst Intel",
        "",
        "This chat is linked for catalyst alerts.",
        `Chat ID: ${chatId}`,
        "",
        "Next steps:",
        "1. Open Alerts in Catalyst Intel",
        "2. Choose Telegram and paste this chat ID",
        "3. Save the rule, then tap Test to confirm delivery",
        "",
        "You will receive a calm, scannable message for each matching catalyst — symbol, impact, session, and a link back to the desk.",
      ].join("\n"),
    });
  }

  return NextResponse.json({ ok: true });
}
