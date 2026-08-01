/**
 * Admin-only per-user feed source visibility.
 * Toggles hide/show vendor rows in *that admin's* feeds only — ingest and
 * other users are unchanged. Missing DB row ⇒ all feed-row sources on.
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

export async function loadEnabledSourcesForUser(
  userId: number,
): Promise<{ enabledSources: CatalystSourceId[]; persisted: boolean }> {
  const row = await db
    .select({ enabledSources: userSourceSettings.enabledSources })
    .from(userSourceSettings)
    .where(eq(userSourceSettings.userId, userId))
    .get();

  if (!row) {
    return { enabledSources: defaultEnabledFeedSources(), persisted: false };
  }

  return {
    enabledSources: normalizeEnabledSources(row.enabledSources),
    persisted: true,
  };
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
  const { enabledSources } = await loadEnabledSourcesForUser(userId);
  return constrainProvidersForEnabledSources(enabledSources);
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

export async function upsertEnabledSourcesForUser(
  userId: number,
  enabledSources: CatalystSourceId[],
): Promise<CatalystSourceId[]> {
  const normalized = normalizeEnabledSources(enabledSources);
  const existing = await db
    .select({ id: userSourceSettings.id })
    .from(userSourceSettings)
    .where(eq(userSourceSettings.userId, userId))
    .get();

  const updatedAt = new Date().toISOString();
  if (existing) {
    await db
      .update(userSourceSettings)
      .set({ enabledSources: normalized, updatedAt })
      .where(eq(userSourceSettings.userId, userId))
      .run();
  } else {
    await db
      .insert(userSourceSettings)
      .values({ userId, enabledSources: normalized, updatedAt })
      .run();
  }
  return normalized;
}
