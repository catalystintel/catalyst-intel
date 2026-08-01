/**
 * Admin-only personal feed display prefs.
 * Currently: whether vendor source labels show on tape / split / details.
 * Does not filter or hide feed rows. Missing DB row ⇒ labels off.
 */

import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { userSourceSettings } from "@/db/schema";
import {
  CATALYST_SOURCE_IDS,
  type CatalystSourceId,
} from "@/lib/jobs/catalyst-sources";

/**
 * Default for the legacy `enabled_sources` NOT NULL column when inserting a
 * new prefs row. Filtering UI was removed; column kept for migration compat.
 */
function defaultEnabledFeedSources(): CatalystSourceId[] {
  return CATALYST_SOURCE_IDS.filter((id) => id !== "polygon-prices");
}

export function normalizeShowSourceLabels(raw: unknown): boolean {
  return raw === true || raw === 1 || raw === "1" || raw === "true";
}

export type UserSourceSettings = {
  showSourceLabels: boolean;
  persisted: boolean;
};

export async function loadSourceSettingsForUser(
  userId: number,
): Promise<UserSourceSettings> {
  const row = await db
    .select({
      showSourceLabels: userSourceSettings.showSourceLabels,
    })
    .from(userSourceSettings)
    .where(eq(userSourceSettings.userId, userId))
    .get();

  if (!row) {
    return { showSourceLabels: false, persisted: false };
  }

  return {
    showSourceLabels: Boolean(row.showSourceLabels),
    persisted: true,
  };
}

/**
 * Whether this admin wants vendor source labels on the tape.
 * Non-admins always get `false`.
 */
export async function resolveAdminShowSourceLabels(
  userId: number,
  isAdmin: boolean,
): Promise<boolean> {
  if (!isAdmin) return false;
  const { showSourceLabels } = await loadSourceSettingsForUser(userId);
  return showSourceLabels;
}

async function ensureSourceSettingsRow(userId: number): Promise<void> {
  const existing = await db
    .select({ id: userSourceSettings.id })
    .from(userSourceSettings)
    .where(eq(userSourceSettings.userId, userId))
    .get();
  if (existing) return;

  await db
    .insert(userSourceSettings)
    .values({
      userId,
      enabledSources: defaultEnabledFeedSources(),
      showSourceLabels: false,
      updatedAt: new Date().toISOString(),
    })
    .run();
}

export async function upsertShowSourceLabelsForUser(
  userId: number,
  showSourceLabels: boolean,
): Promise<boolean> {
  await ensureSourceSettingsRow(userId);
  await db
    .update(userSourceSettings)
    .set({ showSourceLabels, updatedAt: new Date().toISOString() })
    .where(eq(userSourceSettings.userId, userId))
    .run();
  return showSourceLabels;
}
