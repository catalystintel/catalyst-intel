/**
 * Thin Telegram Bot API client. Free forever, no per-message cost — the
 * closest zero-cost stand-in for SMS. Create a bot via @BotFather on
 * Telegram, paste the token as TELEGRAM_BOT_TOKEN.
 *
 * After deploy, an admin should hit POST /api/admin/telegram/setup (or the
 * Admin UI button) so we register the webhook, slash commands, description,
 * and brand profile photo. Users then /start the bot to get their chat_id.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { isValidCronSecret } from "@/lib/auth/cron-secret";

export type TelegramSendResult = { ok: boolean; detail: string };

export type TelegramBotCommand = {
  command: string;
  description: string;
};

/** Slash commands shown in Telegram’s “Menu” / autocomplete. */
export const TELEGRAM_BOT_COMMANDS: TelegramBotCommand[] = [
  {
    command: "start",
    description: "Connect and get your chat ID",
  },
  {
    command: "id",
    description: "Show your Telegram chat ID",
  },
  {
    command: "help",
    description: "How to wire Catalyst Intel alerts",
  },
];

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
}

/**
 * Optional public @username (without @) so the desk UI can deep-link to
 * `https://t.me/<username>`. Soft — webhook still works without it.
 */
export function getTelegramBotUsername(): string | undefined {
  const raw =
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim() ||
    process.env.TELEGRAM_BOT_USERNAME?.trim();
  if (!raw) return undefined;
  return raw.replace(/^@/, "");
}

export type TelegramBotIdentity = {
  username: string | null;
  firstName: string | null;
  /** `https://t.me/<username>` when username is known */
  deepLink: string | null;
  /** `@username` when known */
  handle: string | null;
};

function identityFromUsername(
  username: string | null | undefined,
  firstName?: string | null,
): TelegramBotIdentity {
  const clean = username?.replace(/^@/, "").trim() || null;
  return {
    username: clean,
    firstName: firstName?.trim() || null,
    deepLink: clean ? `https://t.me/${clean}` : null,
    handle: clean ? `@${clean}` : null,
  };
}

let cachedBotIdentity: {
  at: number;
  identity: TelegramBotIdentity;
} | null = null;

const BOT_IDENTITY_CACHE_MS = 5 * 60_000;

/** Test helper — clears the in-memory getMe cache. */
export function clearTelegramBotIdentityCache(): void {
  cachedBotIdentity = null;
}

/**
 * Resolves the live bot @username via getMe (cached ~5m), falling back to
 * NEXT_PUBLIC_TELEGRAM_BOT_USERNAME / TELEGRAM_BOT_USERNAME. Never throws.
 */
export async function resolveTelegramBotIdentity(): Promise<TelegramBotIdentity> {
  const envFallback = identityFromUsername(getTelegramBotUsername());

  if (!isTelegramConfigured()) {
    return envFallback;
  }

  const now = Date.now();
  if (cachedBotIdentity && now - cachedBotIdentity.at < BOT_IDENTITY_CACHE_MS) {
    return cachedBotIdentity.identity.username
      ? cachedBotIdentity.identity
      : envFallback.username
        ? envFallback
        : cachedBotIdentity.identity;
  }

  const me = await getTelegramBotProfile();
  if (me.ok && (me.username || me.firstName)) {
    const identity = identityFromUsername(
      me.username ?? envFallback.username,
      me.firstName,
    );
    cachedBotIdentity = { at: now, identity };
    return identity;
  }

  if (envFallback.username) {
    cachedBotIdentity = { at: now, identity: envFallback };
    return envFallback;
  }

  const empty = identityFromUsername(null);
  cachedBotIdentity = { at: now, identity: empty };
  return empty;
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

function getBotToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || undefined;
}

function botApiUrl(method: string): string | null {
  const token = getBotToken();
  if (!token) return null;
  return `https://api.telegram.org/bot${token}/${method}`;
}

/**
 * Strip @BotName suffix Telegram appends in groups (`/start@MyBot`).
 */
export function normalizeTelegramCommand(raw: string): string {
  const trimmed = raw.trim();
  const withoutSlash = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  const commandPart = withoutSlash.split(/\s+/, 1)[0] ?? "";
  const base = commandPart.split("@", 1)[0] ?? "";
  return base.toLowerCase();
}

/**
 * Parse the leading slash-command from a message, if any.
 */
export function parseTelegramCommand(
  text: string | undefined | null,
): { command: string; args: string } | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const match = /^\/([^\s@]+)(?:@[^\s]+)?(?:\s+([\s\S]*))?$/.exec(trimmed);
  if (!match) return null;
  return {
    command: (match[1] ?? "").toLowerCase(),
    args: (match[2] ?? "").trim(),
  };
}

/** HTML-escaped plain text for Telegram `parse_mode: HTML`. */
export function escapeTelegramHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function telegramChatIdReply(chatId: string | number): string {
  return [
    "<b>Your Telegram chat ID</b>",
    "",
    `<code>${escapeTelegramHtml(String(chatId))}</code>`,
    "",
    "Copy that number into a Telegram alert rule at /alerts, then hit Test.",
  ].join("\n");
}

export function telegramWelcomeReply(chatId: string | number): string {
  return [
    "<b>Catalyst Intel</b> — bot connected.",
    "",
    "Your chat ID (paste this into /alerts):",
    `<code>${escapeTelegramHtml(String(chatId))}</code>`,
    "",
    "Commands:",
    "/id — show this chat ID again",
    "/help — how alerts work",
  ].join("\n");
}

export function telegramHelpReply(chatId: string | number): string {
  return [
    "<b>How Telegram alerts work</b>",
    "",
    "1. Copy your chat ID below",
    "2. Open Catalyst Intel → Alerts",
    "3. Create a Telegram rule and paste the ID",
    "4. Save &amp; Test — you should get a fire here",
    "",
    `Your chat ID: <code>${escapeTelegramHtml(String(chatId))}</code>`,
  ].join("\n");
}

/**
 * Pick the reply body for an inbound user message.
 */
export function buildTelegramInboundReply(options: {
  chatId: string | number;
  text?: string | null;
}): { text: string; parseMode: "HTML" } {
  const parsed = parseTelegramCommand(options.text);
  const command = parsed?.command;

  if (command === "help") {
    return { text: telegramHelpReply(options.chatId), parseMode: "HTML" };
  }
  if (command === "id" || command === "chatid" || command === "chat_id") {
    return { text: telegramChatIdReply(options.chatId), parseMode: "HTML" };
  }
  // /start and any other message (including plain text) → welcome + chat id
  return { text: telegramWelcomeReply(options.chatId), parseMode: "HTML" };
}

/**
 * Low-level JSON Bot API call. Never throws.
 */
export async function callTelegramApi(
  method: string,
  body?: Record<string, unknown>,
): Promise<TelegramSendResult & { result?: unknown }> {
  const url = botApiUrl(method);
  if (!url) {
    return {
      ok: false,
      detail: "Telegram delivery is not available right now.",
    };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12_000),
    });
    const raw = await res.text().catch(() => "");
    let parsed: { ok?: boolean; description?: string; result?: unknown } = {};
    try {
      parsed = raw ? (JSON.parse(raw) as typeof parsed) : {};
    } catch {
      parsed = {};
    }
    if (!res.ok || parsed.ok === false) {
      return {
        ok: false,
        detail:
          parsed.description ??
          (raw
            ? `Telegram HTTP ${res.status}: ${raw.slice(0, 220)}`
            : `Telegram HTTP ${res.status}`),
      };
    }
    return {
      ok: true,
      detail: `${method} ok`,
      result: parsed.result,
    };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "Telegram API call failed",
    };
  }
}

/**
 * Sends a message to a chat. Never throws.
 */
export async function sendTelegramMessage(options: {
  chatId: string;
  text: string;
  parseMode?: "HTML" | "MarkdownV2";
  disableWebPagePreview?: boolean;
}): Promise<TelegramSendResult> {
  if (!getBotToken()) {
    return {
      ok: false,
      detail: "Telegram delivery is not available right now.",
    };
  }

  const chatId = options.chatId.trim();
  if (!chatId) {
    return { ok: false, detail: "Missing Telegram chat id." };
  }

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text: options.text,
    disable_web_page_preview: options.disableWebPagePreview ?? false,
  };
  if (options.parseMode) {
    payload.parse_mode = options.parseMode;
  }

  const result = await callTelegramApi("sendMessage", payload);
  return {
    ok: result.ok,
    detail: result.ok ? "Telegram message sent" : result.detail,
  };
}

export async function getTelegramBotProfile(): Promise<
  TelegramSendResult & {
    username?: string;
    firstName?: string;
    id?: number;
  }
> {
  const result = await callTelegramApi("getMe");
  if (!result.ok) return { ok: false, detail: result.detail };
  const me = result.result as
    { id?: number; username?: string; first_name?: string } | undefined;
  return {
    ok: true,
    detail: "getMe ok",
    id: me?.id,
    username: me?.username,
    firstName: me?.first_name,
  };
}

export async function setTelegramWebhook(options: {
  url: string;
  secretToken: string;
}): Promise<TelegramSendResult> {
  return callTelegramApi("setWebhook", {
    url: options.url,
    secret_token: options.secretToken,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
}

export async function setTelegramBotCommands(
  commands: TelegramBotCommand[] = TELEGRAM_BOT_COMMANDS,
): Promise<TelegramSendResult> {
  return callTelegramApi("setMyCommands", { commands });
}

export async function setTelegramBotDescriptions(): Promise<{
  description: TelegramSendResult;
  shortDescription: TelegramSendResult;
}> {
  const description = await callTelegramApi("setMyDescription", {
    description:
      "Catalyst Intel alerts bot.\n\nSend /start to get your chat ID, then paste it into Alerts on the desk. You’ll receive catalyst fires here when your rules match.",
  });
  const shortDescription = await callTelegramApi("setMyShortDescription", {
    short_description:
      "Get your chat ID and receive Catalyst Intel alert fires on Telegram.",
  });
  return { description, shortDescription };
}

/**
 * Absolute path to the committed brand avatar (JPG required by Telegram).
 */
export function telegramBotAvatarPath(): string {
  return path.join(process.cwd(), "public", "telegram-bot-avatar.jpg");
}

/**
 * Upload the Catalyst Intel brand mark as the bot profile photo via
 * `setMyProfilePhoto` (static JPG).
 */
export async function setTelegramBotProfilePhoto(
  avatarFilePath: string = telegramBotAvatarPath(),
): Promise<TelegramSendResult> {
  const url = botApiUrl("setMyProfilePhoto");
  if (!url) {
    return {
      ok: false,
      detail: "Telegram delivery is not available right now.",
    };
  }

  try {
    const bytes = await readFile(avatarFilePath);
    const form = new FormData();
    // Telegram wants InputProfilePhotoStatic as JSON + a fresh file upload.
    form.append(
      "photo",
      JSON.stringify({ type: "static", photo: "attach://avatar" }),
    );
    form.append(
      "avatar",
      new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }),
      "telegram-bot-avatar.jpg",
    );

    const res = await fetch(url, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await res.text().catch(() => "");
    let parsed: { ok?: boolean; description?: string } = {};
    try {
      parsed = raw ? (JSON.parse(raw) as typeof parsed) : {};
    } catch {
      parsed = {};
    }
    if (!res.ok || parsed.ok === false) {
      return {
        ok: false,
        detail:
          parsed.description ??
          `Telegram HTTP ${res.status}${raw ? `: ${raw.slice(0, 220)}` : ""}`,
      };
    }
    return { ok: true, detail: "Profile photo updated" };
  } catch (err) {
    return {
      ok: false,
      detail:
        err instanceof Error
          ? err.message
          : "Telegram profile photo upload failed",
    };
  }
}

export type TelegramSetupReport = {
  ok: boolean;
  bot?: { id?: number; username?: string; firstName?: string };
  webhookUrl: string;
  steps: Record<string, TelegramSendResult>;
};

/**
 * One-shot ops setup: webhook + slash commands + descriptions + brand avatar.
 */
export async function setupTelegramBot(options: {
  webhookUrl: string;
}): Promise<TelegramSetupReport> {
  const secret = getTelegramWebhookSecret();
  if (!isTelegramConfigured()) {
    return {
      ok: false,
      webhookUrl: options.webhookUrl,
      steps: {
        token: {
          ok: false,
          detail: "TELEGRAM_BOT_TOKEN is not set.",
        },
      },
    };
  }
  if (!secret) {
    return {
      ok: false,
      webhookUrl: options.webhookUrl,
      steps: {
        secret: {
          ok: false,
          detail: "TELEGRAM_WEBHOOK_SECRET is not set.",
        },
      },
    };
  }

  const me = await getTelegramBotProfile();
  if (me.ok) {
    // Warm the identity cache so /alerts shows @username immediately.
    clearTelegramBotIdentityCache();
    cachedBotIdentity = {
      at: Date.now(),
      identity: identityFromUsername(me.username, me.firstName),
    };
  }
  const webhook = await setTelegramWebhook({
    url: options.webhookUrl,
    secretToken: secret,
  });
  const commands = await setTelegramBotCommands();
  const { description, shortDescription } = await setTelegramBotDescriptions();
  const photo = await setTelegramBotProfilePhoto();

  const steps = {
    getMe: { ok: me.ok, detail: me.detail },
    setWebhook: webhook,
    setMyCommands: commands,
    setMyDescription: description,
    setMyShortDescription: shortDescription,
    setMyProfilePhoto: photo,
  };

  const ok = Object.values(steps).every((s) => s.ok);

  return {
    ok,
    webhookUrl: options.webhookUrl,
    bot: me.ok
      ? { id: me.id, username: me.username, firstName: me.firstName }
      : undefined,
    steps,
  };
}
