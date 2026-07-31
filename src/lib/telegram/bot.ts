/**
 * Thin Telegram Bot API client. Free forever, no per-message cost — the
 * closest zero-cost stand-in for SMS. Create a bot via @BotFather on
 * Telegram, paste the token as TELEGRAM_BOT_TOKEN.
 *
 * Webhook registration should include `secret_token` so Telegram sends
 * `X-Telegram-Bot-Api-Secret-Token` on every update (see webhook route).
 */

import { isValidCronSecret } from "@/lib/auth/cron-secret";

export type TelegramSendResult = { ok: boolean; detail: string };

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}

/**
 * Shared secret used when registering the Telegram webhook (`secret_token`).
 * Fail closed when unset — the webhook route rejects all updates.
 */
export function getTelegramWebhookSecret(): string | undefined {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  return secret || undefined;
}

/**
 * Verifies Telegram's `X-Telegram-Bot-Api-Secret-Token` header against
 * `TELEGRAM_WEBHOOK_SECRET` using a timing-safe compare.
 */
export function isValidTelegramWebhookSecret(provided: string | null): boolean {
  return isValidCronSecret(getTelegramWebhookSecret(), provided);
}

/**
 * Sends a plain-text message to a chat. `chatId` is whatever numeric/string
 * id Telegram assigns once a user messages the bot (getUpdates or a webhook
 * — see /api/telegram/webhook). Never throws.
 */
export async function sendTelegramMessage(options: {
  chatId: string;
  text: string;
}): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) {
    return {
      ok: false,
      detail: "Telegram delivery is not available right now.",
    };
  }

  const chatId = options.chatId.trim();
  if (!chatId) {
    return { ok: false, detail: "Missing Telegram chat id." };
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: options.text,
          disable_web_page_preview: false,
        }),
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        detail: `Telegram HTTP ${res.status}${body ? `: ${body.slice(0, 180)}` : ""}`,
      };
    }
    return { ok: true, detail: "Telegram message sent" };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "Telegram send failed",
    };
  }
}
