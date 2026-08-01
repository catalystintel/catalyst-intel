/**
 * Admin-only per-user feed preferences.
 * - Source visibility: hide/show vendor rows in *that admin's* feeds only.
 * - Source labels: show vendor name on tape / split / details for that admin.
 * Ingest and other users are unchanged. Missing DB row ⇒ all sources on,
 * source labels off.
 */

import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { userSourceSettings } from "@/db/schema";
import {
  CATALYST_SOURCE_CATALOG,
  CATALYST_SOURCE_IDS,
  isCatalystSourceId,
  type CatalystSourceId,
} from "@/lib/jobs/catalyst-sources";

/** Sources that produce catalyst / news tape rows (not enrichment-only). */
export const FEED_ROW_SOURCE_IDS: readonly CatalystSourceId[] =
  CATALYST_SOURCE_IDS.filter((id) => id !== "polygon-prices");

/** Sentinel provider that never matches a real row (all sources off). */
export const NO_FEED_PROVIDER = "__no_feed_provider__";

export type UserSourceSettings = {
  enabledSources: CatalystSourceId[];
  showSourceLabels: boolean;
  persisted: boolean;
};

/**
 * Map catalog source id → `raw_sources.provider` value(s) used at ingest.
 * Most ids match 1:1; polygon-news writes provider `"polygon"`.
 */
export function providersForSourceId(id: CatalystSourceId): string[] {
  if (id === "polygon-news") return ["polygon"];
  if (id === "polygon-prices") return [];
  return [id];
}

export function providersForEnabledSources(
  enabled: readonly CatalystSourceId[],
): string[] {
  const out = new Set<string>();
  for (const id of enabled) {
    for (const p of providersForSourceId(id)) out.add(p);
  }
  return [...out];
}

export function defaultEnabledFeedSources(): CatalystSourceId[] {
  return [...FEED_ROW_SOURCE_IDS];
}

export function feedSourceCatalogEntries() {
  return CATALYST_SOURCE_CATALOG.filter((s) =>
    (FEED_ROW_SOURCE_IDS as readonly string[]).includes(s.id),
  );
}

/** Normalize arbitrary JSON / API payload to a valid enabled-source list. */
export function normalizeEnabledSources(raw: unknown): CatalystSourceId[] {
  if (!Array.isArray(raw)) return defaultEnabledFeedSources();
  const seen = new Set<CatalystSourceId>();
  for (const item of raw) {
    if (typeof item !== "string" || !isCatalystSourceId(item)) continue;
    if (item === "polygon-prices") continue;
    seen.add(item);
  }
  // Preserve catalog order for stable UI / diffs.
  return FEED_ROW_SOURCE_IDS.filter((id) => seen.has(id));
}

export function normalizeShowSourceLabels(raw: unknown): boolean {
  return raw === true || raw === 1 || raw === "1" || raw === "true";
}

export function isAllFeedSourcesEnabled(
  enabled: readonly CatalystSourceId[],
): boolean {
  return (
    enabled.length === FEED_ROW_SOURCE_IDS.length &&
    FEED_ROW_SOURCE_IDS.every((id) => enabled.includes(id))
  );
}

/**
 * Providers this admin should see. `null` = no constraint (all on / non-admin).
 * Empty array ⇒ force empty feed via {@link NO_FEED_PROVIDER}.
 */
export function constrainProvidersForEnabledSources(
  enabled: readonly CatalystSourceId[],
): string[] | null {
  if (isAllFeedSourcesEnabled(enabled)) return null;
  const providers = providersForEnabledSources(enabled);
  return providers.length > 0 ? providers : [NO_FEED_PROVIDER];
}

export async function loadSourceSettingsForUser(
  userId: number,
): Promise<UserSourceSettings> {
  const row = await db
    .select({
      enabledSources: userSourceSettings.enabledSources,
      showSourceLabels: userSourceSettings.showSourceLabels,
    })
    .from(userSourceSettings)
    .where(eq(userSourceSettings.userId, userId))
    .get();

  if (!row) {
    return {
      enabledSources: defaultEnabledFeedSources(),
      showSourceLabels: false,
      persisted: false,
    };
  }

  return {
    enabledSources: normalizeEnabledSources(row.enabledSources),
    showSourceLabels: Boolean(row.showSourceLabels),
    persisted: true,
  };
}

/** @deprecated Prefer {@link loadSourceSettingsForUser}. */
export async function loadEnabledSourcesForUser(
  userId: number,
): Promise<{ enabledSources: CatalystSourceId[]; persisted: boolean }> {
  const { enabledSources, persisted } = await loadSourceSettingsForUser(userId);
  return { enabledSources, persisted };
}

/**
 * For admin feeds: resolve include-list of `raw_sources.provider` values.
 * Non-admins / all-on ⇒ `null` (no extra filter).
 */
export async function resolveAdminFeedProviders(
  userId: number,
  isAdmin: boolean,
): Promise<string[] | null> {
  if (!isAdmin) return null;
  const { enabledSources } = await loadSourceSettingsForUser(userId);
  return constrainProvidersForEnabledSources(enabledSources);
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

/** Merge admin personal providers into an existing include-list (local-dev facet). */
export function mergeSourceProviderFilters(
  existing: string[],
  adminProviders: string[] | null,
): string[] {
  if (!adminProviders) return existing;
  if (existing.length === 0) return adminProviders;
  const allow = new Set(adminProviders);
  const intersected = existing.filter((p) => allow.has(p));
  return intersected.length > 0 ? intersected : [NO_FEED_PROVIDER];
}

async function ensureSourceSettingsRow(
  userId: number,
): Promise<{ id: number }> {
  const existing = await db
    .select({ id: userSourceSettings.id })
    .from(userSourceSettings)
    .where(eq(userSourceSettings.userId, userId))
    .get();
  if (existing) return existing;

  const updatedAt = new Date().toISOString();
  await db
    .insert(userSourceSettings)
    .values({
      userId,
      enabledSources: defaultEnabledFeedSources(),
      showSourceLabels: false,
      updatedAt,
    })
    .run();

  const created = await db
    .select({ id: userSourceSettings.id })
    .from(userSourceSettings)
    .where(eq(userSourceSettings.userId, userId))
    .get();
  if (!created) {
    throw new Error("Failed to create user_source_settings row.");
  }
  return created;
}

export async function upsertEnabledSourcesForUser(
  userId: number,
  enabledSources: CatalystSourceId[],
): Promise<CatalystSourceId[]> {
  const normalized = normalizeEnabledSources(enabledSources);
  await ensureSourceSettingsRow(userId);
  const updatedAt = new Date().toISOString();
  await db
    .update(userSourceSettings)
    .set({ enabledSources: normalized, updatedAt })
    .where(eq(userSourceSettings.userId, userId))
    .run();
  return normalized;
}

export async function upsertShowSourceLabelsForUser(
  userId: number,
  showSourceLabels: boolean,
): Promise<boolean> {
  await ensureSourceSettingsRow(userId);
  const updatedAt = new Date().toISOString();
  await db
    .update(userSourceSettings)
    .set({ showSourceLabels, updatedAt })
    .where(eq(userSourceSettings.userId, userId))
    .run();
  return showSourceLabels;
}
