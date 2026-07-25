import {
  isFeedFormFilter,
  type FeedFormFilter,
} from "@/lib/catalysts/feed-form-filters";
import {
  isFeedTimeWindow,
  type FeedTimeWindow,
} from "@/lib/catalysts/feed-time-window";
import {
  isGicsSectorKey,
  type GicsSectorKey,
} from "@/lib/companies/gics-sectors";
import { isEventCategoryKey } from "@/lib/catalysts/taxonomy";
import type { EventCategoryKey } from "@/lib/jobs/parse-8k-items";

/**
 * Live-tape filter persistence. Survives remounts / navigation for up to
 * {@link FEED_FILTER_IDLE_MS} of idle time, then falls back to product
 * defaults so a forgotten session doesn't haunt the next day.
 */
export const FEED_FILTER_STORAGE_KEY = "ci.feed-filters.v2";
export const FEED_FILTER_IDLE_MS = 60 * 60 * 1000; // 1 hour

export interface PersistedFeedFilters {
  tickerQuery: string;
  categoryFilters: EventCategoryKey[];
  sectorFilters: GicsSectorKey[];
  formFilters: FeedFormFilter[];
  sourceFilters: string[];
  timeWindow: FeedTimeWindow;
  /**
   * Always true for the desk tape (ticker required; CPI / Jobs NFP excepted).
   * Kept on the persisted shape for API query compat / legacy readers.
   */
  tickerOnly: boolean;
  /** Epoch ms of last activity while these filters were in use. */
  lastActiveAt: number;
}

export type FeedFilterState = Omit<PersistedFeedFilters, "lastActiveAt">;

/** Product defaults after idle expiry / Clear filters. */
export const DEFAULT_FEED_FILTERS: FeedFilterState = {
  tickerQuery: "",
  categoryFilters: [],
  sectorFilters: [],
  formFilters: [],
  sourceFilters: [],
  timeWindow: "all",
  /** Always on: tradable names only (CPI / Jobs NFP still allowed). */
  tickerOnly: true,
};

/**
 * True when search / time / facet gates match product defaults.
 * Ignores `tickerOnly` — that gate is always enforced server-side.
 */
export function isPanelFiltersDefault(filters: FeedFilterState): boolean {
  return (
    !filters.tickerQuery.trim() &&
    filters.categoryFilters.length === 0 &&
    filters.sectorFilters.length === 0 &&
    filters.formFilters.length === 0 &&
    filters.sourceFilters.length === 0 &&
    filters.timeWindow === "all"
  );
}

/** Full product default (panel filters + ticker-only desk default). */
export function isFiltersDefault(filters: FeedFilterState): boolean {
  return isPanelFiltersDefault(filters) && filters.tickerOnly === true;
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is string => typeof v === "string" && v.trim() !== "",
  );
}

export function readPersistedFeedFilters(
  now = Date.now(),
): FeedFilterState | null {
  if (typeof window === "undefined") return null;
  try {
    // Prefer v2; fall back to legacy v1 key once.
    const raw =
      window.localStorage.getItem(FEED_FILTER_STORAGE_KEY) ??
      window.localStorage.getItem("ci.feed-filters.v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedFeedFilters> & {
      categoryFilter?: string | null;
      minImpact?: string;
    };
    const lastActiveAt =
      typeof parsed.lastActiveAt === "number" ? parsed.lastActiveAt : 0;
    if (!lastActiveAt || now - lastActiveAt > FEED_FILTER_IDLE_MS) {
      window.localStorage.removeItem(FEED_FILTER_STORAGE_KEY);
      window.localStorage.removeItem("ci.feed-filters.v1");
      return null;
    }

    const tickerQuery =
      typeof parsed.tickerQuery === "string" ? parsed.tickerQuery : "";
    let categoryFilters = parseStringArray(parsed.categoryFilters).filter(
      isEventCategoryKey,
    );
    // Legacy single categoryFilter → array
    if (
      categoryFilters.length === 0 &&
      typeof parsed.categoryFilter === "string" &&
      isEventCategoryKey(parsed.categoryFilter)
    ) {
      categoryFilters = [parsed.categoryFilter];
    }
    const sectorFilters = parseStringArray(parsed.sectorFilters).filter(
      isGicsSectorKey,
    );
    const formFilters = parseStringArray(parsed.formFilters).filter(
      isFeedFormFilter,
    );
    const sourceFilters = parseStringArray(parsed.sourceFilters).map((s) =>
      s.toLowerCase(),
    );
    const timeWindow =
      typeof parsed.timeWindow === "string" &&
      isFeedTimeWindow(parsed.timeWindow)
        ? parsed.timeWindow
        : "all";
    return {
      tickerQuery,
      categoryFilters,
      sectorFilters,
      formFilters,
      sourceFilters,
      timeWindow,
      // Always enforce ticker gate (ignore legacy persisted false).
      tickerOnly: true,
    };
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
    window.localStorage.removeItem("ci.feed-filters.v1");
    return;
  }
  const payload: PersistedFeedFilters = {
    tickerQuery: filters.tickerQuery,
    categoryFilters: filters.categoryFilters,
    sectorFilters: filters.sectorFilters,
    formFilters: filters.formFilters,
    sourceFilters: filters.sourceFilters,
    timeWindow: filters.timeWindow,
    tickerOnly: filters.tickerOnly,
    lastActiveAt: now,
  };
  window.localStorage.setItem(FEED_FILTER_STORAGE_KEY, JSON.stringify(payload));
  window.localStorage.removeItem("ci.feed-filters.v1");
}

export function clearPersistedFeedFilters(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(FEED_FILTER_STORAGE_KEY);
  window.localStorage.removeItem("ci.feed-filters.v1");
}

/** Bump lastActiveAt without changing filter values (keeps an active session alive). */
export function touchPersistedFeedFilters(now = Date.now()): void {
  const current = readPersistedFeedFilters(now);
  if (!current) return;
  writePersistedFeedFilters(current, now);
}

/** Build `/api/catalysts` query string from filter state + optional cursor. */
export function feedApiQuery(
  filters: FeedFilterState,
  options?: { cursor?: string | null; limit?: number; facets?: boolean },
): string {
  const params = new URLSearchParams();
  params.set("window", filters.timeWindow);
  if (filters.tickerQuery.trim()) params.set("q", filters.tickerQuery.trim());
  if (filters.categoryFilters.length > 0) {
    params.set("categories", filters.categoryFilters.join(","));
  }
  if (filters.sectorFilters.length > 0) {
    params.set("sectors", filters.sectorFilters.join(","));
  }
  if (filters.formFilters.length > 0) {
    params.set("forms", filters.formFilters.join(","));
  }
  if (filters.sourceFilters.length > 0) {
    params.set("sources", filters.sourceFilters.join(","));
  }
  // Always request the ticker gate (server also enforces unconditionally).
  params.set("tickerOnly", "1");
  if (options?.cursor) params.set("cursor", options.cursor);
  if (typeof options?.limit === "number") {
    params.set("limit", String(options.limit));
  }
  if (options?.facets === false) params.set("facets", "0");
  return params.toString();
}
