/**
 * Inbound Telegram update handling: slash commands, reply-keyboard labels,
 * `/start <link-token>`, and inline mute callbacks.
 */

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  alertDeliveries,
  alertRules,
  catalysts,
  users,
  watchlists,
} from "@/db/schema";
import {
  answerTelegramCallbackQuery,
  escapeTelegramHtml,
  MAIN_REPLY_KEYBOARD,
  parseTelegramCommand,
  sendTelegramMessage,
  type TelegramInlineKeyboard,
  type TelegramReplyKeyboard,
} from "@/lib/telegram/bot";
import {
  getTelegramLinkByChatId,
  isTelegramLinkMuted,
  muteTelegramChatFor,
  redeemTelegramLinkToken,
  unmuteTelegramChat,
} from "@/lib/telegram/link";

export type TelegramOutbound = {
  text: string;
  parseMode?: "HTML";
  replyMarkup?: TelegramReplyKeyboard | TelegramInlineKeyboard;
  disableWebPagePreview?: boolean;
};

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

function normalizeMenuLabel(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (t === "status") return "status";
  if (t === "recent") return "recent";
  if (t === "mute 1h" || t === "mute") return "mute";
  if (t === "unmute") return "unmute";
  if (t === "help") return "help";
  if (t === "chat id" || t === "chatid" || t === "id") return "id";
  return null;
}

export function telegramWelcomeReply(options: {
  chatId: string | number;
  linkedEmail?: string | null;
}): TelegramOutbound {
  const linked = options.linkedEmail
    ? `Linked to <code>${escapeTelegramHtml(maskEmail(options.linkedEmail))}</code>.`
    : "Not linked yet — open <b>Alerts</b> on the desk and tap <b>Connect Telegram</b>.";

  return {
    text: [
      "<b>Catalyst Intel</b>",
      "",
      linked,
      "",
      "Alerts fire here when your watchlist rules match.",
      "",
      "Menu:",
      "/status — link + mute + rules",
      "/recent — latest fires",
      "/mute — silence alerts for 1 hour",
      "/unmute — resume alerts",
      "/id — show this chat ID",
      "/help — how it works",
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: MAIN_REPLY_KEYBOARD,
    disableWebPagePreview: true,
  };
}

export function telegramHelpReply(chatId: string | number): TelegramOutbound {
  return {
    text: [
      "<b>How Telegram alerts work</b>",
      "",
      "1. On the desk → Alerts → <b>Connect Telegram</b>",
      "2. Telegram opens with a link token — tap Start",
      "3. Create a Telegram rule (chat ID autofills when linked)",
      "4. Save &amp; Test — you should get a fire here",
      "",
      "You can still paste a chat ID manually if you prefer.",
      "",
      `Chat ID: <code>${escapeTelegramHtml(String(chatId))}</code>`,
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: MAIN_REPLY_KEYBOARD,
    disableWebPagePreview: true,
  };
}

export function telegramChatIdReply(chatId: string | number): TelegramOutbound {
  return {
    text: [
      "<b>Your Telegram chat ID</b>",
      "",
      `<code>${escapeTelegramHtml(String(chatId))}</code>`,
      "",
      "Prefer Connect Telegram on /alerts — paste only if you need a manual override.",
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: MAIN_REPLY_KEYBOARD,
    disableWebPagePreview: true,
  };
}

async function statusReply(chatId: string): Promise<TelegramOutbound> {
  const link = await getTelegramLinkByChatId(chatId);
  if (!link) {
    return {
      text: [
        "<b>Status</b>",
        "",
        "Not linked to a desk account.",
        "Open Alerts → <b>Connect Telegram</b> to bind this chat.",
        "",
        `Chat ID: <code>${escapeTelegramHtml(chatId)}</code>`,
      ].join("\n"),
      parseMode: "HTML",
      replyMarkup: MAIN_REPLY_KEYBOARD,
      disableWebPagePreview: true,
    };
  }

  const account = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, link.userId))
    .get();

  const ruleRows = await db
    .select({ channel: alertRules.channel, enabled: alertRules.enabled })
    .from(alertRules)
    .where(eq(alertRules.userId, link.userId))
    .all();

  const telegramEnabled = ruleRows.filter(
    (r) => r.channel === "telegram" && r.enabled,
  ).length;

  const watchlistCount = (
    await db
      .select({ id: watchlists.id })
      .from(watchlists)
      .where(eq(watchlists.userId, link.userId))
      .all()
  ).length;

  const muted = isTelegramLinkMuted(link);
  const muteLine = muted
    ? `Muted until ${escapeTelegramHtml(link.mutedUntil ?? "")}`
    : "Alerts: live";

  return {
    text: [
      "<b>Status</b>",
      "",
      `Account: <code>${escapeTelegramHtml(maskEmail(account?.email ?? "—"))}</code>`,
      muteLine,
      `Telegram rules: ${telegramEnabled}`,
      `Watchlists: ${watchlistCount}`,
      "",
      `Chat ID: <code>${escapeTelegramHtml(chatId)}</code>`,
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: MAIN_REPLY_KEYBOARD,
    disableWebPagePreview: true,
  };
}

async function recentReply(chatId: string): Promise<TelegramOutbound> {
  const link = await getTelegramLinkByChatId(chatId);
  if (!link) {
    return {
      text: "Link your account first (Alerts → Connect Telegram) to see recent fires.",
      parseMode: "HTML",
      replyMarkup: MAIN_REPLY_KEYBOARD,
    };
  }

  const rows = await db
    .select({
      status: alertDeliveries.status,
      createdAt: alertDeliveries.createdAt,
      ruleName: alertRules.name,
      symbol: catalysts.symbol,
      headline: catalysts.headline,
      title: catalysts.title,
    })
    .from(alertDeliveries)
    .innerJoin(alertRules, eq(alertDeliveries.alertRuleId, alertRules.id))
    .leftJoin(catalysts, eq(alertDeliveries.catalystId, catalysts.id))
    .where(
      and(
        eq(alertRules.userId, link.userId),
        eq(alertDeliveries.channel, "telegram"),
      ),
    )
    .orderBy(desc(alertDeliveries.createdAt))
    .limit(5)
    .all();

  if (rows.length === 0) {
    return {
      text: [
        "<b>Recent fires</b>",
        "",
        "No deliveries yet. Create a Telegram rule and hit Test on /alerts.",
      ].join("\n"),
      parseMode: "HTML",
      replyMarkup: MAIN_REPLY_KEYBOARD,
    };
  }

  const lines = ["<b>Recent fires</b>", ""];
  for (const row of rows) {
    const sym = (row.symbol ?? "—").toUpperCase();
    const head = (row.headline ?? row.title ?? "Catalyst").slice(0, 80);
    lines.push(
      `<b>${escapeTelegramHtml(sym)}</b> · ${escapeTelegramHtml(row.ruleName)}`,
      escapeTelegramHtml(head),
      `${escapeTelegramHtml(row.status)} · ${escapeTelegramHtml(row.createdAt)}`,
      "",
    );
  }

  return {
    text: lines.join("\n").trimEnd(),
    parseMode: "HTML",
    replyMarkup: MAIN_REPLY_KEYBOARD,
    disableWebPagePreview: true,
  };
}

async function muteReply(chatId: string): Promise<TelegramOutbound> {
  const link = await muteTelegramChatFor(chatId);
  if (!link) {
    return {
      text: "Link your account first (Alerts → Connect Telegram), then /mute works.",
      parseMode: "HTML",
      replyMarkup: MAIN_REPLY_KEYBOARD,
    };
  }
  return {
    text: [
      "<b>Muted for 1 hour</b>",
      "",
      `Until <code>${escapeTelegramHtml(link.mutedUntil ?? "")}</code>`,
      "Send /unmute to resume earlier.",
    ].join("\n"),
    parseMode: "HTML",
    replyMarkup: MAIN_REPLY_KEYBOARD,
  };
}

async function unmuteReply(chatId: string): Promise<TelegramOutbound> {
  const link = await unmuteTelegramChat(chatId);
  if (!link) {
    return {
      text: "Link your account first (Alerts → Connect Telegram).",
      parseMode: "HTML",
      replyMarkup: MAIN_REPLY_KEYBOARD,
    };
  }
  return {
    text: "<b>Alerts resumed</b> — you’ll get the next matching fire here.",
    parseMode: "HTML",
    replyMarkup: MAIN_REPLY_KEYBOARD,
  };
}

/**
 * Build the outbound reply for a text message (commands + keyboard labels).
 */
export async function buildTelegramMessageReply(options: {
  chatId: string;
  text?: string | null;
  from?: { id?: number; username?: string } | null;
}): Promise<TelegramOutbound> {
  const chatId = options.chatId;
  const parsed = parseTelegramCommand(options.text);
  const menuCommand = normalizeMenuLabel(options.text);
  const command = parsed?.command ?? menuCommand;

  if (command === "start" && parsed?.args) {
    const redeemed = await redeemTelegramLinkToken({
      token: parsed.args,
      chatId,
      telegramUserId:
        options.from?.id !== undefined ? String(options.from.id) : null,
      username: options.from?.username ?? null,
    });
    if (!redeemed.ok) {
      return {
        text: [
          "<b>Couldn’t link</b>",
          "",
          escapeTelegramHtml(redeemed.detail),
        ].join("\n"),
        parseMode: "HTML",
        replyMarkup: MAIN_REPLY_KEYBOARD,
      };
    }
    return {
      text: [
        "<b>Linked</b>",
        "",
        `This chat is connected to <code>${escapeTelegramHtml(maskEmail(redeemed.email))}</code>.`,
        "",
        "Create a Telegram alert rule on the desk — chat ID is optional now.",
        "Use the menu below anytime.",
      ].join("\n"),
      parseMode: "HTML",
      replyMarkup: MAIN_REPLY_KEYBOARD,
      disableWebPagePreview: true,
    };
  }

  if (command === "help") return telegramHelpReply(chatId);
  if (command === "id" || command === "chatid" || command === "chat_id") {
    return telegramChatIdReply(chatId);
  }
  if (command === "status") return statusReply(chatId);
  if (command === "recent") return recentReply(chatId);
  if (command === "mute") return muteReply(chatId);
  if (command === "unmute") return unmuteReply(chatId);

  const link = await getTelegramLinkByChatId(chatId);
  let linkedEmail: string | null = null;
  if (link) {
    const account = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, link.userId))
      .get();
    linkedEmail = account?.email ?? null;
  }
  return telegramWelcomeReply({ chatId, linkedEmail });
}

/**
 * Handle inline keyboard callbacks (currently mute / unmute).
 */
export async function handleTelegramCallback(options: {
  callbackQueryId: string;
  chatId: string;
  data?: string | null;
}): Promise<void> {
  const data = (options.data ?? "").trim();
  let notice = "OK";
  let outbound: TelegramOutbound | null = null;

  if (data === "mute:1h" || data === "mute") {
    outbound = await muteReply(options.chatId);
    notice = "Muted for 1 hour";
  } else if (data === "unmute") {
    outbound = await unmuteReply(options.chatId);
    notice = "Alerts resumed";
  } else {
    notice = "Unknown action";
  }

  await answerTelegramCallbackQuery({
    callbackQueryId: options.callbackQueryId,
    text: notice,
  });

  if (outbound) {
    await sendTelegramMessage({
      chatId: options.chatId,
      text: outbound.text,
      parseMode: outbound.parseMode,
      replyMarkup: outbound.replyMarkup,
      disableWebPagePreview: outbound.disableWebPagePreview ?? true,
    });
  }
}
