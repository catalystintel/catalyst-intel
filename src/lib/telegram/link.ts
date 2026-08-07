/**
 * Telegram account linking: short-lived `/start <token>` deep-links bind a
 * desk `users` row to a Telegram chat so alert rules can omit a pasted chat id.
 */

import { and, eq, gt, inArray, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { telegramLinkTokens, telegramLinks, users } from "@/db/schema";
import { getTelegramBotUsername } from "@/lib/telegram/bot";

export const TELEGRAM_LINK_TOKEN_TTL_MS = 15 * 60_000;
export const TELEGRAM_MUTE_DEFAULT_MS = 60 * 60_000;

export type TelegramLinkRow = typeof telegramLinks.$inferSelect;

/** URL-safe token (~22 chars) — fits Telegram’s 64-char start payload. */
export function createTelegramLinkTokenValue(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function telegramDeepLinkForStart(token: string): string | null {
  const username = getTelegramBotUsername();
  if (!username) return null;
  return `https://t.me/${username}?start=${encodeURIComponent(token)}`;
}

export async function getTelegramLinkByUserId(
  userId: number,
): Promise<TelegramLinkRow | null> {
  return (
    (await db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.userId, userId))
      .get()) ?? null
  );
}

export async function getTelegramLinkByChatId(
  chatId: string,
): Promise<TelegramLinkRow | null> {
  const id = chatId.trim();
  if (!id) return null;
  return (
    (await db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.chatId, id))
      .get()) ?? null
  );
}

export function isTelegramLinkMuted(
  link: Pick<TelegramLinkRow, "mutedUntil"> | null | undefined,
  now = Date.now(),
): boolean {
  if (!link?.mutedUntil) return false;
  const until = Date.parse(link.mutedUntil);
  return Number.isFinite(until) && until > now;
}

/**
 * Creates a one-time link token and returns the Telegram deep-link (when the
 * bot username is known) plus the raw token for fallback UX.
 */
export async function createTelegramLinkSession(userId: number): Promise<{
  token: string;
  expiresAt: string;
  deepLink: string | null;
}> {
  const token = createTelegramLinkTokenValue();
  const expiresAt = new Date(
    Date.now() + TELEGRAM_LINK_TOKEN_TTL_MS,
  ).toISOString();

  await db.insert(telegramLinkTokens).values({
    token,
    userId,
    expiresAt,
  });

  return {
    token,
    expiresAt,
    deepLink: telegramDeepLinkForStart(token),
  };
}

export async function unlinkTelegramForUser(userId: number): Promise<boolean> {
  const result = await db
    .delete(telegramLinks)
    .where(eq(telegramLinks.userId, userId))
    .run();
  return (result.rowsAffected ?? 0) > 0;
}

/**
 * Redeems `/start <token>`: binds chat → user. A chat can only belong to one
 * user; re-linking moves the chat and replaces any prior link for that user.
 */
export async function redeemTelegramLinkToken(options: {
  token: string;
  chatId: string;
  telegramUserId?: string | null;
  username?: string | null;
}): Promise<
  { ok: true; email: string; userId: number } | { ok: false; detail: string }
> {
  const token = options.token.trim();
  if (!token || token.length > 64) {
    return { ok: false, detail: "Invalid link token." };
  }

  const chatId = options.chatId.trim();
  if (!chatId) {
    return { ok: false, detail: "Missing chat id." };
  }

  const nowIso = new Date().toISOString();
  const row = await db
    .select({
      id: telegramLinkTokens.id,
      userId: telegramLinkTokens.userId,
      expiresAt: telegramLinkTokens.expiresAt,
      usedAt: telegramLinkTokens.usedAt,
      email: users.email,
    })
    .from(telegramLinkTokens)
    .innerJoin(users, eq(users.id, telegramLinkTokens.userId))
    .where(
      and(
        eq(telegramLinkTokens.token, token),
        isNull(telegramLinkTokens.usedAt),
        gt(telegramLinkTokens.expiresAt, nowIso),
      ),
    )
    .get();

  if (!row) {
    return {
      ok: false,
      detail:
        "Link expired or already used. Open Alerts on the desk and tap Connect Telegram again.",
    };
  }

  // Free the chat if another account held it; replace this user's prior link.
  await db.delete(telegramLinks).where(eq(telegramLinks.chatId, chatId)).run();
  await db
    .delete(telegramLinks)
    .where(eq(telegramLinks.userId, row.userId))
    .run();

  await db.insert(telegramLinks).values({
    userId: row.userId,
    chatId,
    telegramUserId: options.telegramUserId?.trim() || null,
    username: options.username?.trim().replace(/^@/, "") || null,
    mutedUntil: null,
    linkedAt: nowIso,
  });

  await db
    .update(telegramLinkTokens)
    .set({ usedAt: nowIso })
    .where(eq(telegramLinkTokens.id, row.id))
    .run();

  return { ok: true, email: row.email, userId: row.userId };
}

export async function setTelegramMute(options: {
  chatId: string;
  mutedUntil: string | null;
}): Promise<TelegramLinkRow | null> {
  const link = await getTelegramLinkByChatId(options.chatId);
  if (!link) return null;
  await db
    .update(telegramLinks)
    .set({ mutedUntil: options.mutedUntil })
    .where(eq(telegramLinks.id, link.id))
    .run();
  return {
    ...link,
    mutedUntil: options.mutedUntil,
  };
}

export async function muteTelegramChatFor(
  chatId: string,
  durationMs: number = TELEGRAM_MUTE_DEFAULT_MS,
): Promise<TelegramLinkRow | null> {
  const mutedUntil = new Date(Date.now() + durationMs).toISOString();
  return setTelegramMute({ chatId, mutedUntil });
}

export async function unmuteTelegramChat(
  chatId: string,
): Promise<TelegramLinkRow | null> {
  return setTelegramMute({ chatId, mutedUntil: null });
}

/** Load linked chat ids for a set of users (auto-fire / deliver fallback). */
export async function telegramChatIdsByUserIds(
  userIds: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (userIds.length === 0) return map;
  const rows = await db
    .select({
      userId: telegramLinks.userId,
      chatId: telegramLinks.chatId,
    })
    .from(telegramLinks)
    .where(inArray(telegramLinks.userId, userIds))
    .all();
  for (const row of rows) {
    map.set(row.userId, row.chatId);
  }
  return map;
}
