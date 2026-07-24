import {
  CATEGORY_LABELS,
  isEventCategoryKey,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";
import { materialityFromScore } from "@/lib/catalysts/materiality";
import {
  bucketMinutesForAnalyticsWindow,
  hoursForAnalyticsWindow,
  type AnalyticsWindow,
} from "@/lib/catalysts/analytics-window";

/** Minimal row shape the aggregation needs - a subset of the `catalysts` table. */
export interface AnalyticsRow {
  ticker: string | null;
  eventCategory: string | null;
  impactScore: number | null;
  timestamp: string;
  sector: string | null;
}

export interface CategoryCount {
  category: EventCategoryKey;
  label: string;
  count: number;
}

export interface MaterialityCounts {
  high: number;
  medium: number;
  low: number;
}

export interface SectorCount {
  sector: string;
  count: number;
}

export interface TickerStat {
  ticker: string;
  count: number;
  avgImpact: number;
}

export interface VolumePoint {
  bucketStart: string;
  count: number;
}

export interface AnalyticsSummary {
  totalCount: number;
  highImpactCount: number;
  activeTickerCount: number;
  avgImpactScore: number;
  categoryCounts: CategoryCount[];
  materialityCounts: MaterialityCounts;
  sectorCounts: SectorCount[];
  topTickers: TickerStat[];
  volumeSeries: VolumePoint[];
}

/**
 * Aggregates a window of catalyst rows into the shapes the Analytics
 * dashboard's widgets render directly - counts by category/materiality/
 * sector, top tickers, and a time-bucketed volume series. Kept separate
 * from the route handler (src/app/api/analytics/route.ts) so it's plain,
 * synchronous, and easy to test without a database.
 */
export function buildAnalyticsSummary(
  rows: AnalyticsRow[],
  window: AnalyticsWindow,
  now = Date.now(),
): AnalyticsSummary {
  const categoryCounts = new Map<EventCategoryKey, number>();
  const materialityCounts: MaterialityCounts = { high: 0, medium: 0, low: 0 };
  const sectorCounts = new Map<string, number>();
  const tickerStats = new Map<string, { count: number; totalImpact: number }>();
  let impactSum = 0;
  let impactCount = 0;

  for (const row of rows) {
    const category = isEventCategoryKey(row.eventCategory ?? "")
      ? (row.eventCategory as EventCategoryKey)
      : "other";
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);

    const tier = materialityFromScore(row.impactScore, category).tier;
    materialityCounts[tier] += 1;

    if (row.sector) {
      sectorCounts.set(row.sector, (sectorCounts.get(row.sector) ?? 0) + 1);
    }

    if (row.ticker) {
      const entry = tickerStats.get(row.ticker) ?? { count: 0, totalImpact: 0 };
      entry.count += 1;
      entry.totalImpact += row.impactScore ?? 0;
      tickerStats.set(row.ticker, entry);
    }

    if (typeof row.impactScore === "number") {
      impactSum += row.impactScore;
      impactCount += 1;
    }
  }

  return {
    totalCount: rows.length,
    highImpactCount: materialityCounts.high,
    activeTickerCount: tickerStats.size,
    avgImpactScore: impactCount > 0 ? Math.round(impactSum / impactCount) : 0,
    categoryCounts: [...categoryCounts.entries()]
      .map(([category, count]) => ({
        category,
        label: CATEGORY_LABELS[category],
        count,
      }))
      .sort((a, b) => b.count - a.count),
    materialityCounts,
    sectorCounts: [...sectorCounts.entries()]
      .map(([sector, count]) => ({ sector, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    topTickers: [...tickerStats.entries()]
      .map(([ticker, { count, totalImpact }]) => ({
        ticker,
        count,
        avgImpact: Math.round(totalImpact / count),
      }))
      .sort((a, b) => b.count - a.count || b.avgImpact - a.avgImpact)
      .slice(0, 10),
    volumeSeries: buildVolumeSeries(rows, window, now),
  };
}

function buildVolumeSeries(
  rows: AnalyticsRow[],
  window: AnalyticsWindow,
  now: number,
): VolumePoint[] {
  const bucketMs = bucketMinutesForAnalyticsWindow(window) * 60_000;
  const totalMs = hoursForAnalyticsWindow(window) * 60 * 60_000;
  const bucketCount = Math.max(1, Math.ceil(totalMs / bucketMs));
  const startMs = now - bucketCount * bucketMs;

  const counts = new Array<number>(bucketCount).fill(0);
  for (const row of rows) {
    const t = new Date(row.timestamp).getTime();
    if (!Number.isFinite(t)) continue;
    const index = Math.floor((t - startMs) / bucketMs);
    if (index < 0 || index >= bucketCount) continue;
    counts[index] += 1;
  }

  return counts.map((count, index) => ({
    bucketStart: new Date(startMs + index * bucketMs).toISOString(),
    count,
  }));
}
