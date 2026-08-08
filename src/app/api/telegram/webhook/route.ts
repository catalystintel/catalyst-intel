import { NextResponse, type NextRequest } from "next/server";

import {
  buildTelegramMessageReply,
  handleTelegramCallback,
} from "@/lib/telegram/handlers";
import {
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
 * Handles /start (optional link token), menu commands, reply-keyboard labels,
 * and inline mute callbacks. Always returns 200 for authenticated updates so
 * Telegram doesn't retry/disable the hook; unauthenticated requests get 401.
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

  const root =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;

  const callback =
    root && typeof root.callback_query === "object" && root.callback_query
      ? (root.callback_query as {
          id?: string;
          data?: string;
          message?: { chat?: { id?: number | string } };
        })
      : undefined;

  if (callback?.id && callback.message?.chat?.id !== undefined) {
    await handleTelegramCallback({
      callbackQueryId: callback.id,
      chatId: String(callback.message.chat.id),
      data: callback.data,
    });
    return NextResponse.json({ ok: true });
  }

  const message =
    root && typeof root.message === "object" && root.message
      ? (root.message as {
          chat?: { id?: number | string };
          text?: string;
          from?: { id?: number; username?: string };
        })
      : undefined;
  const chatId = message?.chat?.id;

  if (chatId !== undefined) {
    const reply = await buildTelegramMessageReply({
      chatId: String(chatId),
      text: message?.text,
      from: message?.from ?? null,
    });
    await sendTelegramMessage({
      chatId: String(chatId),
      text: reply.text,
      parseMode: reply.parseMode,
      replyMarkup: reply.replyMarkup,
      disableWebPagePreview: reply.disableWebPagePreview ?? true,
    });
  }

  return NextResponse.json({ ok: true });
}
