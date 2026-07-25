/**
 * Snapshot builder for saved catalyst digests (Reports).
 *
 * Items are frozen at save time so share links never drift with the live tape.
 * Max 80 items: ordered by impactScore desc, then timestamp desc.
 */

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { catalysts, rawSources, watchlistEntries } from "@/db/schema";
import type { ReportScope, ReportWindow } from "@/db/schema";
import type { AnalyticsWindow } from "@/lib/catalysts/analytics-window";
import { hoursForAnalyticsWindow } from "@/lib/catalysts/analytics-window";
import { isEventCategoryKey } from "@/lib/catalysts/taxonomy";
import type { ReportSnapshotItem } from "./types";

export const REPORT_MAX_ITEMS = 80;

/** ISO lower bound for the report's lookback window. */
export function sinceIsoForReportWindow(
  window: ReportWindow,
  now = Date.now(),
): string {
  const hours = hoursForAnalyticsWindow(window as AnalyticsWindow);
  return new Date(now - hours * 60 * 60_000).toISOString();
}

/** Auto-generated title when the user leaves the field blank. */
export function defaultReportTitle(
  window: ReportWindow,
  scope: ReportScope,
  now = Date.now(),
): string {
  const date = new Date(now).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const scopeLabel = scope === "watchlist" ? "Watchlist" : "All catalysts";
  return `${scopeLabel} \u00b7 ${window} \u00b7 ${date}`;
}

/** URL-safe base64 token (16 random bytes → ~22 chars, no padding). */
export function createShareToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Coerce a raw DB row into a typed `ReportSnapshotItem`. */
export function normalizeReportItems(
  rows: {
    id: number;
    symbol: string | null;
    title: string;
    eventCategory: string | null;
    impactScore: number | null;
    timestamp: string;
    sourceProvider: string | null;
    type: string;
  }[],
): ReportSnapshotItem[] {
  return rows.slice(0, REPORT_MAX_ITEMS).map((r) => ({
    id: r.id,
    symbol: r.symbol,
    title: r.title,
    eventCategory:
      r.eventCategory && isEventCategoryKey(r.eventCategory)
        ? r.eventCategory
        : null,
    impactScore: r.impactScore,
    timestamp: r.timestamp,
    sourceProvider: r.sourceProvider,
    type: r.type,
  }));
}

/**
 * Query and return snapshot items for a report.
 * Returns [] immediately when scope is "watchlist" and the watchlist is empty.
 */
export async function buildReportSnapshot(
  userId: number,
  window: ReportWindow,
  scope: ReportScope,
  now = Date.now(),
): Promise<ReportSnapshotItem[]> {
  const since = sinceIsoForReportWindow(window, now);

  let symbolFilter: string[] | null = null;

  if (scope === "watchlist") {
    const entries = await db
      .select({ symbol: watchlistEntries.symbol })
      .from(watchlistEntries)
      .where(eq(watchlistEntries.userId, userId))
      .all();
    symbolFilter = entries.map((e) => e.symbol);
    if (symbolFilter.length === 0) return [];
  }

  const whereParts = [gte(catalysts.timestamp, since)];
  if (symbolFilter && symbolFilter.length > 0) {
    whereParts.push(inArray(catalysts.symbol, symbolFilter));
  }

  const rows = await db
    .select({
      id: catalysts.id,
      symbol: catalysts.symbol,
      title: catalysts.title,
      eventCategory: catalysts.eventCategory,
      impactScore: catalysts.impactScore,
      timestamp: catalysts.timestamp,
      sourceProvider: rawSources.provider,
      type: catalysts.type,
    })
    .from(catalysts)
    .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
    .where(and(...whereParts))
    .orderBy(
      desc(sql`COALESCE(${catalysts.impactScore}, 0)`),
      desc(catalysts.timestamp),
    )
    .limit(REPORT_MAX_ITEMS)
    .all();

  return normalizeReportItems(rows);
}
