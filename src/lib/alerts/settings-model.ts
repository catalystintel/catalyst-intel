/**
 * Client-safe notification settings model (no DB imports).
 */

import type { AlertRuleConditions } from "@/db/schema";
import { normalizeWatchlistIds } from "@/lib/catalysts/playbook";

export const NOTIFICATION_CHANNELS = ["push", "telegram", "email"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const MANAGED_RULE_NAMES: Record<NotificationChannel, string> = {
  push: "Push notifications",
  telegram: "Telegram notifications",
  email: "Email notifications",
};

export type NotificationChannelsState = Record<NotificationChannel, boolean>;

export type NotificationSettings = {
  channels: NotificationChannelsState;
  watchlistIds: number[];
};

export function emptyNotificationChannels(): NotificationChannelsState {
  return { push: false, telegram: false, email: false };
}

/** Derive the simplified settings view from existing rules. */
export function deriveNotificationSettings(
  rules: {
    channel: string;
    enabled: boolean;
    conditions: AlertRuleConditions;
  }[],
): NotificationSettings {
  const channels = emptyNotificationChannels();
  const idSet = new Set<number>();

  for (const rule of rules) {
    if (
      rule.channel !== "push" &&
      rule.channel !== "telegram" &&
      rule.channel !== "email"
    ) {
      continue;
    }
    if (rule.enabled) {
      channels[rule.channel] = true;
      for (const id of rule.conditions.watchlistIds ?? []) {
        idSet.add(id);
      }
    }
  }

  return {
    channels,
    watchlistIds: [...idSet].sort((a, b) => a - b),
  };
}

export function parseNotificationSettingsBody(raw: unknown):
  | {
      ok: true;
      settings: NotificationSettings;
      telegramChatId?: string | null;
    }
  | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Invalid JSON body." };
  }
  const body = raw as Record<string, unknown>;
  const ch =
    typeof body.channels === "object" && body.channels !== null
      ? (body.channels as Record<string, unknown>)
      : {};

  const channels: NotificationChannelsState = {
    push: Boolean(ch.push),
    telegram: Boolean(ch.telegram),
    email: Boolean(ch.email),
  };
  const watchlistIds = normalizeWatchlistIds(body.watchlistIds);
  const telegramChatId =
    typeof body.telegramChatId === "string" && body.telegramChatId.trim()
      ? body.telegramChatId.trim()
      : body.telegramChatId === null
        ? null
        : undefined;

  const anyChannel = channels.push || channels.telegram || channels.email;
  if (anyChannel && watchlistIds.length === 0) {
    return {
      ok: false,
      error: "Pick at least one watchlist when a notification method is on.",
    };
  }

  return {
    ok: true,
    settings: { channels, watchlistIds },
    telegramChatId,
  };
}
