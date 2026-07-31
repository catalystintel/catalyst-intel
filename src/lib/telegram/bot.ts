/**
 * Thin Telegram Bot API client. Free forever, no per-message cost — the
 * closest zero-cost stand-in for SMS. Create a bot via @BotFather on
 * Telegram, paste the token as TELEGRAM_BOT_TOKEN.
 */

export type TelegramSendResult = { ok: boolean; detail: string };

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
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
