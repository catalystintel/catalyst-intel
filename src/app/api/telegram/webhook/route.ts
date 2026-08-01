import { NextResponse, type NextRequest } from "next/server";

import {
  buildTelegramInboundReply,
  isValidTelegramWebhookSecret,
  sendTelegramMessage,
} from "@/lib/telegram/bot";

/**
 * Telegram webhook target. Register once after deploy (HTTPS required) via
 * Admin → “Setup Telegram bot”, or:
 *
 *   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
 *     -H "Content-Type: application/json" \
 *     -d '{"url":"https://<your-domain>/api/telegram/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
 *
 * Handles /start, /id, /help (and any other text) by replying with the user's
 * chat_id so they can paste it into an alert rule. Always returns 200 for
 * authenticated updates so Telegram doesn't retry/disable the hook;
 * unauthenticated requests get 401.
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
      ? (
          body as {
            message?: {
              chat?: { id?: number | string };
              text?: string;
            };
          }
        ).message
      : undefined;
  const chatId = message?.chat?.id;

  if (chatId !== undefined) {
    const reply = buildTelegramInboundReply({
      chatId,
      text: message?.text,
    });
    await sendTelegramMessage({
      chatId: String(chatId),
      text: reply.text,
      parseMode: reply.parseMode,
      disableWebPagePreview: true,
    });
  }

  return NextResponse.json({ ok: true });
}
