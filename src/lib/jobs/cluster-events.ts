/**
 * Cross-source event clustering — merges catalysts from different sources
 * (halt + 8-K + wire, or SEC + Finnhub + Polygon) that fire for the same
 * symbol within a short window into one decision object, so the Live feed
 * doesn't show three thin rows for what a trader experiences as one event.
 *
 * Only materializes a cluster when 2+ catalysts actually merge — a lone
 * event never gets a clusterId (see db/schema.ts eventClusters).
 *
 * Feed queries show only the cluster primary (or unclustered rows).
 */

import { and, eq, gte, inArray, isNull, isNotNull } from "drizzle-orm";

import { db } from "@/db/client";
import { catalysts, eventClusters, rawSources } from "@/db/schema";
import {
  areNearDuplicateTitles,
  pickClusterPrimary,
} from "@/lib/jobs/dedupe-catalysts";

export const CLUSTER_WINDOW_MINUTES = 45;
const DEFAULT_LOOKBACK_MINUTES = 180;

export interface ClusterableRow {
  id: number;
  symbol: string;
  timestamp: string;
  impactScore: number | null;
  eventCategory: string | null;
  provider?: string | null;
  title?: string | null;
  headline?: string | null;
}

export interface ClusterGroup {
  symbol: string;
  category: string | null;
  windowStart: string;
  windowEnd: string;
  memberIds: number[];
  primaryId: number;
}

/**
 * Whether two same-symbol rows in a time window should share a cluster.
 * Related cascade (halt + filing / wire retelling) merges; unrelated
 * Form 4 vs earnings on a busy name does not.
 */
export function shouldClusterTogether(
  a: ClusterableRow,
  b: ClusterableRow,
): boolean {
  const catA = a.eventCategory ?? "";
  const catB = b.eventCategory ?? "";

  if (catA && catA === catB) return true;

  // Halt cascades with the filing / wire that follows.
  if (catA === "trading_halt" || catB === "trading_halt") return true;

  const titleA = a.headline ?? a.title;
  const titleB = b.headline ?? b.title;
  if (areNearDuplicateTitles(titleA, titleB)) return true;

  return false;
}

/**
 * Pure grouping logic (no DB) — groups same-symbol rows into windows where
 * consecutive related events are within `windowMinutes` of the window's
 * start, then keeps only groups with 2+ members. Exported for unit testing.
 */
export function groupIntoWindows(
  rows: ClusterableRow[],
  windowMinutes: number = CLUSTER_WINDOW_MINUTES,
): ClusterGroup[] {
  const bySymbol = new Map<string, ClusterableRow[]>();
  for (const row of rows) {
    const list = bySymbol.get(row.symbol) ?? [];
    list.push(row);
    bySymbol.set(row.symbol, list);
  }

  const groups: ClusterGroup[] = [];
  const windowMs = windowMinutes * 60 * 1000;

  for (const [symbol, symbolRows] of bySymbol) {
    const sorted = [...symbolRows].sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
    );

    let current: ClusterableRow[] = [];
    let windowStartMs = 0;

    const flush = () => {
      if (current.length < 2) {
        current = [];
        return;
      }
      const primary = pickClusterPrimary(current);
      groups.push({
        symbol,
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

      const relatedToWindow = current.some((member) =>
        shouldClusterTogether(member, row),
      );

      if (t - windowStartMs <= windowMs && relatedToWindow) {
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
 * DB wrapper: pulls recent, still-unclustered, symbol-bearing catalysts,
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
      symbol: catalysts.symbol,
      timestamp: catalysts.timestamp,
      impactScore: catalysts.impactScore,
      eventCategory: catalysts.eventCategory,
      title: catalysts.title,
      headline: catalysts.headline,
      provider: rawSources.provider,
    })
    .from(catalysts)
    .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
    .where(
      and(
        isNotNull(catalysts.symbol),
        isNull(catalysts.clusterId),
        gte(catalysts.timestamp, since),
      ),
    )
    .all();

  const clusterable: ClusterableRow[] = rows
    .filter((r): r is (typeof rows)[number] & { symbol: string } =>
      Boolean(r.symbol),
    )
    .map((r) => ({
      id: r.id,
      symbol: r.symbol,
      timestamp: r.timestamp,
      impactScore: r.impactScore,
      eventCategory: r.eventCategory,
      title: r.title,
      headline: r.headline,
      provider: r.provider,
    }));

  const groups = groupIntoWindows(clusterable, windowMinutes);

  let clustersCreated = 0;
  let catalystsLinked = 0;

  for (const group of groups) {
    const inserted = await db
      .insert(eventClusters)
      .values({
        symbol: group.symbol,
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
