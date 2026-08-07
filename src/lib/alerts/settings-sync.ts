/**
 * Sync simplified notification settings → per-channel `alert_rules` rows.
 * Server-only (imports DB).
 */

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  alertRules,
  watchlists,
  type AlertChannel,
  type AlertRuleConditions,
} from "@/db/schema";
import {
  MANAGED_RULE_NAMES,
  NOTIFICATION_CHANNELS,
  type NotificationSettings,
} from "@/lib/alerts/settings-model";
import { getTelegramLinkByUserId } from "@/lib/telegram/link";

export {
  deriveNotificationSettings,
  emptyNotificationChannels,
  MANAGED_RULE_NAMES,
  NOTIFICATION_CHANNELS,
  parseNotificationSettingsBody,
  type NotificationChannel,
  type NotificationChannelsState,
  type NotificationSettings,
} from "@/lib/alerts/settings-model";

/**
 * Upsert managed per-channel rules for a user. Disables leftover rules on
 * the same channel so the desk stays one-row-per-method.
 */
export async function syncNotificationSettings(options: {
  userId: number;
  email: string;
  settings: NotificationSettings;
  /** Optional explicit chat id override for the Telegram rule. */
  telegramChatId?: string | null;
}): Promise<NotificationSettings> {
  const ownedWatchlists = await db
    .select({ id: watchlists.id })
    .from(watchlists)
    .where(eq(watchlists.userId, options.userId))
    .all();
  const ownedIds = new Set(ownedWatchlists.map((w) => w.id));
  const watchlistIds = options.settings.watchlistIds.filter((id) =>
    ownedIds.has(id),
  );

  if (
    (options.settings.channels.push ||
      options.settings.channels.telegram ||
      options.settings.channels.email) &&
    watchlistIds.length === 0
  ) {
    throw new Error(
      "Pick at least one of your watchlists when a notification method is on.",
    );
  }

  const conditions: AlertRuleConditions = {
    watchlistIds,
  };

  const linked = await getTelegramLinkByUserId(options.userId);
  const existing = await db
    .select()
    .from(alertRules)
    .where(eq(alertRules.userId, options.userId))
    .all();

  for (const channel of NOTIFICATION_CHANNELS) {
    const enabled = options.settings.channels[channel];
    const channelRows = existing
      .filter((r) => r.channel === channel)
      .sort((a, b) => b.id - a.id);
    const primary = channelRows[0] ?? null;
    const extras = channelRows.slice(1);

    if (enabled) {
      const telegramChatId =
        channel === "telegram"
          ? options.telegramChatId?.trim() ||
            primary?.telegramChatId?.trim() ||
            linked?.chatId ||
            null
          : null;
      if (channel === "telegram" && !telegramChatId) {
        throw new Error(
          "Connect Telegram before enabling Telegram notifications.",
        );
      }
      const emailTo = channel === "email" ? options.email : null;
      if (channel === "email" && !emailTo) {
        throw new Error("Signed-in email is required for email notifications.");
      }

      if (primary) {
        await db
          .update(alertRules)
          .set({
            name: MANAGED_RULE_NAMES[channel],
            enabled: true,
            conditions,
            emailTo,
            telegramChatId:
              channel === "telegram" ? telegramChatId : primary.telegramChatId,
            webhookUrl: null,
          })
          .where(
            and(
              eq(alertRules.id, primary.id),
              eq(alertRules.userId, options.userId),
            ),
          )
          .run();
      } else {
        await db
          .insert(alertRules)
          .values({
            userId: options.userId,
            name: MANAGED_RULE_NAMES[channel],
            channel: channel as AlertChannel,
            enabled: true,
            conditions,
            emailTo,
            telegramChatId,
            webhookUrl: null,
          })
          .run();
      }

      if (extras.length > 0) {
        await db
          .update(alertRules)
          .set({ enabled: false })
          .where(
            and(
              eq(alertRules.userId, options.userId),
              inArray(
                alertRules.id,
                extras.map((r) => r.id),
              ),
            ),
          )
          .run();
      }
    } else if (channelRows.length > 0) {
      await db
        .update(alertRules)
        .set({ enabled: false })
        .where(
          and(
            eq(alertRules.userId, options.userId),
            inArray(
              alertRules.id,
              channelRows.map((r) => r.id),
            ),
          ),
        )
        .run();
    }
  }

  return {
    channels: { ...options.settings.channels },
    watchlistIds,
  };
}
