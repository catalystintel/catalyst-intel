import type { EventCategoryKey } from "@/lib/jobs/parse-8k-items";
import {
  isFeedTimeWindow,
  type FeedTimeWindow,
} from "@/lib/catalysts/feed-time-window";
import { isEventCategoryKey } from "@/lib/catalysts/taxonomy";

/**
 * Live-tape filter persistence. Survives remounts / navigation for up to
 * {@link FEED_FILTER_IDLE_MS} of idle time, then falls back to product
 * defaults (including Med+ impact) so a forgotten session doesn't haunt
 * the next day.
 */
export const FEED_FILTER_STORAGE_KEY = "ci.feed-filters.v1";
export const FEED_FILTER_IDLE_MS = 60 * 60 * 1000; // 1 hour

/** Impact floor chips — aligns with materialityFromScore tiers. */
export type FeedImpactFloor = "all" | "medium" | "high";

export const FEED_IMPACT_FLOORS: ReadonlyArray<{
  id: FeedImpactFloor;
  label: string;
  /** Inclusive minimum score (0–100). */
  minScore: number;
}> = [
  { id: "all", label: "All", minScore: 0 },
  { id: "medium", label: "Med+", minScore: 45 },
  { id: "high", label: "High", minScore: 70 },
];

export function isFeedImpactFloor(value: string): value is FeedImpactFloor {
  return value === "all" || value === "medium" || value === "high";
}

export function minScoreForFeedImpactFloor(floor: FeedImpactFloor): number {
  return FEED_IMPACT_FLOORS.find((f) => f.id === floor)?.minScore ?? 0;
}

export interface PersistedFeedFilters {
  tickerQuery: string;
  categoryFilter: EventCategoryKey | null;
  timeWindow: FeedTimeWindow;
  /** Default product floor is Med+ (`medium`). */
  minImpact: FeedImpactFloor;
  /** Epoch ms of last activity while these filters were in use. */
  lastActiveAt: number;
}

export type FeedFilterState = Omit<PersistedFeedFilters, "lastActiveAt">;

/** Product defaults after idle expiry / Clear filters. */
export const DEFAULT_FEED_FILTERS: FeedFilterState = {
  tickerQuery: "",
  categoryFilter: null,
  timeWindow: "all",
  minImpact: "medium",
};

export function isFiltersDefault(filters: FeedFilterState): boolean {
  return (
    !filters.tickerQuery.trim() &&
    filters.categoryFilter === null &&
    filters.timeWindow === "all" &&
    filters.minImpact === DEFAULT_FEED_FILTERS.minImpact
  );
}

export function readPersistedFeedFilters(
  now = Date.now(),
): FeedFilterState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FEED_FILTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedFeedFilters>;
    const lastActiveAt =
      typeof parsed.lastActiveAt === "number" ? parsed.lastActiveAt : 0;
    if (!lastActiveAt || now - lastActiveAt > FEED_FILTER_IDLE_MS) {
      window.localStorage.removeItem(FEED_FILTER_STORAGE_KEY);
      return null;
    }

    const tickerQuery =
      typeof parsed.tickerQuery === "string" ? parsed.tickerQuery : "";
    const categoryFilter =
      typeof parsed.categoryFilter === "string" &&
      isEventCategoryKey(parsed.categoryFilter)
        ? parsed.categoryFilter
        : null;
    const timeWindow =
      typeof parsed.timeWindow === "string" &&
      isFeedTimeWindow(parsed.timeWindow)
        ? parsed.timeWindow
        : "all";
    const minImpact =
      typeof parsed.minImpact === "string" &&
      isFeedImpactFloor(parsed.minImpact)
        ? parsed.minImpact
        : DEFAULT_FEED_FILTERS.minImpact;

    return { tickerQuery, categoryFilter, timeWindow, minImpact };
  } catch {
    return null;
  }
}

export function writePersistedFeedFilters(
  filters: FeedFilterState,
  now = Date.now(),
): void {
  if (typeof window === "undefined") return;
  if (isFiltersDefault(filters)) {
    window.localStorage.removeItem(FEED_FILTER_STORAGE_KEY);
    return;
  }
  const payload: PersistedFeedFilters = {
    tickerQuery: filters.tickerQuery,
    categoryFilter: filters.categoryFilter,
    timeWindow: filters.timeWindow,
    minImpact: filters.minImpact,
    lastActiveAt: now,
  };
  window.localStorage.setItem(FEED_FILTER_STORAGE_KEY, JSON.stringify(payload));
}

export function clearPersistedFeedFilters(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(FEED_FILTER_STORAGE_KEY);
}

/** Bump lastActiveAt without changing filter values (keeps an active session alive). */
export function touchPersistedFeedFilters(now = Date.now()): void {
  const current = readPersistedFeedFilters(now);
  if (!current) return;
  writePersistedFeedFilters(current, now);
}
