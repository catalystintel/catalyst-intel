/**
 * Cross-source event clustering — merges catalysts from different sources
 * (halt + 8-K + wire, or SEC + Finnhub + Polygon) that fire for the same
 * ticker within a short window into one decision object, so the Live feed
 * doesn't show three thin rows for what a trader experiences as one event.
 *
 * Only materializes a cluster when 2+ catalysts actually merge — a lone
 * event never gets a clusterId (see db/schema.ts eventClusters).
 */

import { and, gte, inArray, isNull, isNotNull } from "drizzle-orm";

import { db } from "@/db/client";
import { catalysts, eventClusters } from "@/db/schema";

export const CLUSTER_WINDOW_MINUTES = 45;
const DEFAULT_LOOKBACK_MINUTES = 180;

export interface ClusterableRow {
  id: number;
  ticker: string;
  timestamp: string;
  impactScore: number | null;
  eventCategory: string | null;
}

export interface ClusterGroup {
  ticker: string;
  category: string | null;
  windowStart: string;
  windowEnd: string;
  memberIds: number[];
  primaryId: number;
}

/**
 * Pure grouping logic (no DB) — groups same-ticker rows into windows where
 * consecutive events are within `windowMinutes` of the window's start, then
 * keeps only groups with 2+ members. Exported for unit testing.
 */
export function groupIntoWindows(
  rows: ClusterableRow[],
  windowMinutes: number = CLUSTER_WINDOW_MINUTES,
): ClusterGroup[] {
  const byTicker = new Map<string, ClusterableRow[]>();
  for (const row of rows) {
    const list = byTicker.get(row.ticker) ?? [];
    list.push(row);
    byTicker.set(row.ticker, list);
  }

  const groups: ClusterGroup[] = [];
  const windowMs = windowMinutes * 60 * 1000;

  for (const [ticker, tickerRows] of byTicker) {
    const sorted = [...tickerRows].sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
    );

    let current: ClusterableRow[] = [];
    let windowStartMs = 0;

    const flush = () => {
      if (current.length < 2) {
        current = [];
        return;
      }
      const primary = current.reduce((best, row) =>
        (row.impactScore ?? 0) > (best.impactScore ?? 0) ? row : best,
      );
      groups.push({
        ticker,
        category: primary.eventCategory,
        windowStart: current[0].timestamp,
        windowEnd: current[current.length - 1].timestamp,
        memberIds: current.map((r) => r.id),
        primaryId: primary.id,
      });
      current = [];
    };

    for (const row of sorted) {
      const t = Date.parse(row.timestamp);
      if (Number.isNaN(t)) continue;

      if (current.length === 0) {
        current = [row];
        windowStartMs = t;
        continue;
      }

      if (t - windowStartMs <= windowMs) {
        current.push(row);
      } else {
        flush();
        current = [row];
        windowStartMs = t;
      }
    }
    flush();
  }

  return groups;
}

/**
 * DB wrapper: pulls recent, still-unclustered, ticker-bearing catalysts,
 * groups them, and materializes any 2+ member clusters. Safe to re-run —
 * already-clustered rows (`clusterId IS NOT NULL`) are excluded.
 */
export async function clusterRecentCatalysts(options?: {
  windowMinutes?: number;
  lookbackMinutes?: number;
}): Promise<{ clustersCreated: number; catalystsLinked: number }> {
  const windowMinutes = options?.windowMinutes ?? CLUSTER_WINDOW_MINUTES;
  const lookbackMinutes = options?.lookbackMinutes ?? DEFAULT_LOOKBACK_MINUTES;
  const since = new Date(
    Date.now() - lookbackMinutes * 60 * 1000,
  ).toISOString();

  const rows = await db
    .select({
      id: catalysts.id,
      ticker: catalysts.ticker,
      timestamp: catalysts.timestamp,
      impactScore: catalysts.impactScore,
      eventCategory: catalysts.eventCategory,
    })
    .from(catalysts)
    .where(
      and(
        isNotNull(catalysts.ticker),
        isNull(catalysts.clusterId),
        gte(catalysts.timestamp, since),
      ),
    )
    .all();

  const clusterable: ClusterableRow[] = rows
    .filter((r): r is ClusterableRow & { ticker: string } => Boolean(r.ticker))
    .map((r) => ({ ...r, ticker: r.ticker as string }));

  const groups = groupIntoWindows(clusterable, windowMinutes);

  let clustersCreated = 0;
  let catalystsLinked = 0;

  for (const group of groups) {
    const inserted = await db
      .insert(eventClusters)
      .values({
        ticker: group.ticker,
        category: group.category,
        windowStart: group.windowStart,
        windowEnd: group.windowEnd,
        memberCount: group.memberIds.length,
        primaryCatalystId: group.primaryId,
      })
      .returning({ id: eventClusters.id })
      .get();

    await db
      .update(catalysts)
      .set({ clusterId: inserted.id })
      .where(inArray(catalysts.id, group.memberIds))
      .run();

    clustersCreated++;
    catalystsLinked += group.memberIds.length;
  }

  return { clustersCreated, catalystsLinked };
}
