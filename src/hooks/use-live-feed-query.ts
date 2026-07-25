"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import type { FeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import {
  sortFeedNewestFirst,
  toFeedCatalyst,
} from "@/lib/catalysts/feed-catalyst";
import {
  DEFAULT_FEED_FILTERS,
  feedApiQuery,
  type FeedFilterState,
} from "@/lib/catalysts/feed-filter-persist";
import type { FeedFacets } from "@/lib/catalysts/feed-query-types";

const SEARCH_DEBOUNCE_MS = 280;
const FEED_PAGE_SIZE = 75;

export interface LiveFeedQueryState {
  catalysts: FeedCatalyst[];
  total: number | null;
  facets: FeedFacets | null;
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  /** Client poll clock (when this browser last got a successful response). */
  lastFetchedAt: string | null;
  /** Most recent `raw_sources.fetched_at` from the server (ingest lag). */
  lastIngestedAt: string | null;
  pollError: string | null;
  filterState: FeedFilterState;
  setFilterState: Dispatch<SetStateAction<FeedFilterState>>;
  patchFilters: (patch: Partial<FeedFilterState>) => void;
  clearFilters: () => void;
  refresh: (opts?: { isRetry?: boolean; silent?: boolean }) => Promise<void>;
  loadMore: () => Promise<void>;
  prependOrMerge: (rows: FeedCatalyst[]) => void;
  setPollError: (msg: string | null) => void;
}

/**
 * Server-backed live-tape list: debounced search, facet filters, keyset
 * infinite scroll. Quiet/dismiss remain client overlays on top of results.
 */
export function useLiveFeedQuery(
  initialCatalysts: FeedCatalyst[],
  initialFilters?: Partial<FeedFilterState>,
): LiveFeedQueryState {
  const [filterState, setFilterState] = useState<FeedFilterState>({
    ...DEFAULT_FEED_FILTERS,
    ...initialFilters,
  });
  const [catalysts, setCatalysts] = useState(() =>
    sortFeedNewestFirst(initialCatalysts),
  );
  const [total, setTotal] = useState<number | null>(initialCatalysts.length);
  const [facets, setFacets] = useState<FeedFacets | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [lastIngestedAt, setLastIngestedAt] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const filtersRef = useRef(filterState);

  useEffect(() => {
    filtersRef.current = filterState;
  }, [filterState]);

  const fetchPage = useCallback(
    async (options: {
      cursor?: string | null;
      replace: boolean;
      silent?: boolean;
      signal?: AbortSignal;
    }) => {
      const qs = feedApiQuery(filtersRef.current, {
        cursor: options.cursor,
        limit: FEED_PAGE_SIZE,
        facets: !options.cursor,
      });
      const res = await fetch(`/api/catalysts?${qs}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal: options.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Could not load catalysts.");
      }
      const rows = (data.catalysts ?? []).map(toFeedCatalyst);
      if (options.replace) {
        setCatalysts(sortFeedNewestFirst(rows));
      } else {
        setCatalysts((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          const merged = [...prev];
          for (const row of rows) {
            if (!seen.has(row.id)) merged.push(row);
          }
          return sortFeedNewestFirst(merged);
        });
      }
      if (typeof data.total === "number") setTotal(data.total);
      if (data.facets) setFacets(data.facets);
      setNextCursor(
        typeof data.nextCursor === "string" ? data.nextCursor : null,
      );
      setLastFetchedAt(
        typeof data.fetchedAt === "string"
          ? data.fetchedAt
          : new Date().toISOString(),
      );
      setLastIngestedAt(
        typeof data.lastIngestedAt === "string" ? data.lastIngestedAt : null,
      );
      setPollError(null);
    },
    [],
  );

  const refresh = useCallback(
    async (opts?: { isRetry?: boolean; silent?: boolean }) => {
      if (inFlight.current && !opts?.isRetry) {
        abortRef.current?.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;
      inFlight.current = true;
      if (!opts?.silent) setLoading(true);
      try {
        await fetchPage({
          replace: true,
          silent: opts?.silent,
          signal: controller.signal,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setPollError(
          err instanceof Error ? err.message : "Could not load catalysts.",
        );
      } finally {
        inFlight.current = false;
        setLoading(false);
      }
    },
    [fetchPage],
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      await fetchPage({ cursor: nextCursor, replace: false });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setPollError(
          err instanceof Error ? err.message : "Could not load more.",
        );
      }
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, nextCursor, loadingMore, loading]);

  // Debounced refetch when filters change (skip first mount — SSR seed).
  const skipFirstFilterEffect = useRef(true);
  useEffect(() => {
    if (skipFirstFilterEffect.current) {
      skipFirstFilterEffect.current = false;
      // Still fetch facets for the initial seed when filters are default.
      void refresh({ silent: true });
      return;
    }
    const handle = window.setTimeout(() => {
      void refresh();
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [filterState, refresh]);

  const patchFilters = useCallback((patch: Partial<FeedFilterState>) => {
    setFilterState((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilterState(DEFAULT_FEED_FILTERS);
  }, []);

  const prependOrMerge = useCallback((rows: FeedCatalyst[]) => {
    setCatalysts((prev) => {
      const byId = new Map(prev.map((c) => [c.id, c]));
      for (const row of rows) byId.set(row.id, row);
      return sortFeedNewestFirst([...byId.values()]);
    });
  }, []);

  return {
    catalysts,
    total,
    facets,
    nextCursor,
    loading,
    loadingMore,
    lastFetchedAt,
    lastIngestedAt,
    pollError,
    filterState,
    setFilterState,
    patchFilters,
    clearFilters,
    refresh,
    loadMore,
    prependOrMerge,
    setPollError,
  };
}
