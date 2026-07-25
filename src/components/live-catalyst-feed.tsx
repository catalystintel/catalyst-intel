"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Check,
  ChevronDown,
  ListFilter,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { FeedFilterMultiSelect } from "@/components/feed-filter-multi-select";
import { TapeSplitPanel } from "@/components/tape-split-panel";
import { TickerActionMenu } from "@/components/ticker-action-menu";
import { Input } from "@/components/ui/input";
import { useAutoFocusScrollRegion } from "@/hooks/use-auto-focus-scroll-region";
import { useLiveFeedQuery } from "@/hooks/use-live-feed-query";
import { type FeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import {
  titleLine,
  eventLabel as feedEventLabel,
  sourceDisplay,
} from "@/lib/catalysts/feed-display";
import {
  DEFAULT_PLAYBOOK_CATEGORIES,
  matchesQuietPlaybook,
} from "@/lib/catalysts/playbook";
import {
  CATEGORY_LABELS,
  type EventCategoryKey,
} from "@/lib/jobs/parse-8k-items";
import { FEED_TIME_WINDOWS } from "@/lib/catalysts/feed-time-window";
import { classifyFeedEmpty } from "@/lib/catalysts/feed-empty-state";
import {
  isFiltersDefault,
  readPersistedFeedFilters,
  touchPersistedFeedFilters,
  writePersistedFeedFilters,
  type FeedFilterState,
} from "@/lib/catalysts/feed-filter-persist";
import { INGESTION_STALE_AFTER_MS } from "@/lib/jobs/ingestion-freshness";
import {
  FEED_FORM_LABELS,
  type FeedFormFilter,
} from "@/lib/catalysts/feed-form-filters";
import type { FeedFacets } from "@/lib/catalysts/feed-query-types";
import { gicsLabel, type GicsSectorKey } from "@/lib/companies/gics-sectors";
import { formatClockTime, formatTimeDate } from "@/lib/format/relative-time";
import { cn } from "@/lib/utils";

export type { FeedCatalyst };

const ACTIVE_POLL_MS = 15_000;
const BLURRED_POLL_MS = 90_000;
const DISMISS_STORAGE_KEY = "ci.dismissed-catalyst-ids";

type Presence = "active" | "blurred" | "hidden";

/**
 * Blotter: Title · Time · Event · Ticker · Action (hover toolbar).
 * Time is event occurrence (`catalysts.timestamp` in ET), never DB insert
 * Title is capped so the blotter stays dense; overflow uses ellipsis + hover
 * `title` for the full string. A trailing `1fr` track absorbs leftover width so
 * Action stays right-aligned when the split panel is closed.
 */
const FEED_GRID =
  "grid-cols-1 sm:grid-cols-[minmax(0,340px)_156px_88px_72px_1fr] lg:grid-cols-[minmax(0,400px)_160px_96px_80px_1fr_minmax(268px,max-content)]";

function readPresence(): Presence {
  if (typeof document === "undefined") return "active";
  if (document.visibilityState === "hidden") return "hidden";
  if (typeof document.hasFocus === "function" && !document.hasFocus()) {
    return "blurred";
  }
  return "active";
}

function readDismissedIds(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((n): n is number => typeof n === "number" && n > 0),
    );
  } catch {
    return new Set();
  }
}

function writeDismissedIds(ids: Set<number>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    DISMISS_STORAGE_KEY,
    JSON.stringify([...ids].slice(-200)),
  );
}

export function LiveCatalystFeed({
  initialCatalysts,
  isAdmin,
  initialTickerFilter,
  initialSelectedId,
}: {
  initialCatalysts: FeedCatalyst[];
  isAdmin: boolean;
  /** Pre-fills the ticker filter, e.g. arriving via `?ticker=` from Analytics. */
  initialTickerFilter?: string;
  /** Re-opens the split panel, e.g. arriving via `?c=` after full article. */
  initialSelectedId?: number;
}) {
  const router = useRouter();
  const query = useLiveFeedQuery(initialCatalysts, {
    tickerQuery: initialTickerFilter?.trim() ?? "",
  });
  const {
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
  } = query;

  const [presence, setPresence] = useState<Presence>("active");
  const [flashIds, setFlashIds] = useState<Set<number>>(() => new Set());
  const [selectedId, setSelectedId] = useState<number | null>(
    initialSelectedId && initialSelectedId > 0 ? initialSelectedId : null,
  );
  const [filtersOpen, setFiltersOpen] = useState(Boolean(initialTickerFilter));
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [filterRecalc, setFilterRecalc] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(() =>
    readDismissedIds(),
  );
  const [dismissingIds, setDismissingIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [watchlistTickers, setWatchlistTickers] = useState<string[]>([]);
  const [playbookCategories, setPlaybookCategories] = useState<
    EventCategoryKey[]
  >(DEFAULT_PLAYBOOK_CATEGORIES);
  const [quietMode, setQuietMode] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const skipFilterAnimRef = useRef(true);
  const skipFlashRef = useRef(false);
  const knownIds = useRef(new Set(initialCatalysts.map((c) => c.id)));
  const pollErrorRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadPrefs() {
      try {
        const [wRes, pRes] = await Promise.all([
          fetch("/api/watchlist", {
            credentials: "same-origin",
            cache: "no-store",
          }),
          fetch("/api/playbook", {
            credentials: "same-origin",
            cache: "no-store",
          }),
        ]);
        if (cancelled) return;
        if (wRes.ok) {
          const wData = await wRes.json();
          const tickers = (wData.tickers ?? []).map(
            (t: { ticker: string }) => t.ticker,
          );
          setWatchlistTickers(tickers);
        }
        if (pRes.ok) {
          const pData = await pRes.json();
          setPlaybookCategories(
            Array.isArray(pData.categories) && pData.categories.length > 0
              ? pData.categories
              : DEFAULT_PLAYBOOK_CATEGORIES,
          );
          setQuietMode(Boolean(pData.quietMode));
        }
      } catch {
        // Soft-fail: feed still works without prefs.
      } finally {
        if (!cancelled) setPrefsLoaded(true);
      }
    }
    void loadPrefs();
    return () => {
      cancelled = true;
    };
  }, []);

  // Restore tape filters from localStorage after mount (avoids SSR/hydration
  // mismatch). Deep-link `?ticker=` wins for the ticker field; other saved
  // filters still apply when still within the idle window.
  useEffect(() => {
    const restoreId = window.setTimeout(() => {
      const saved = readPersistedFeedFilters();
      const urlTicker = initialTickerFilter?.trim() ?? "";
      if (urlTicker) {
        setFilterState((prev) => ({
          ...prev,
          tickerQuery: urlTicker,
          ...(saved
            ? {
                categoryFilters: saved.categoryFilters,
                sectorFilters: saved.sectorFilters,
                formFilters: saved.formFilters,
                sourceFilters: saved.sourceFilters,
                timeWindow: saved.timeWindow,
              }
            : {}),
        }));
        setFiltersOpen(true);
      } else if (saved) {
        setFilterState(saved);
        if (!isFiltersDefault(saved)) setFiltersOpen(true);
      }
      setFiltersHydrated(true);
    }, 0);
    return () => window.clearTimeout(restoreId);
  }, [initialTickerFilter, setFilterState]);

  // Persist filters while active; clear storage when back to product defaults.
  useEffect(() => {
    if (!filtersHydrated) return;
    writePersistedFeedFilters(filterState);
  }, [filterState, filtersHydrated]);

  // Keep the idle clock alive while the tab is visible with non-default filters.
  useEffect(() => {
    if (!filtersHydrated) return;
    if (isFiltersDefault(filterState)) return;
    const touch = () => {
      if (document.visibilityState === "visible") {
        touchPersistedFeedFilters();
      }
    };
    const intervalId = window.setInterval(touch, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", touch);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", touch);
    };
  }, [filterState, filtersHydrated]);

  // Brief crossfade when the visible row set is recalculated from filters.
  useEffect(() => {
    skipFlashRef.current = true;
  }, [filterState]);

  useEffect(() => {
    if (!filtersHydrated) return;
    if (skipFilterAnimRef.current) {
      skipFilterAnimRef.current = false;
      return;
    }
    setFilterRecalc(true);
    const timeoutId = window.setTimeout(() => setFilterRecalc(false), 280);
    return () => window.clearTimeout(timeoutId);
  }, [filterState, quietMode, filtersHydrated]);

  useEffect(() => {
    pollErrorRef.current = pollError;
  }, [pollError]);

  // Flash newly-arrived rows on background poll (not filter refetches).
  useEffect(() => {
    if (skipFlashRef.current) {
      skipFlashRef.current = false;
      knownIds.current = new Set(catalysts.map((c) => c.id));
      return;
    }
    const fresh = catalysts
      .filter((c) => !knownIds.current.has(c.id))
      .map((c) => c.id);
    if (fresh.length > 0) {
      for (const id of catalysts.map((c) => c.id)) knownIds.current.add(id);
      setFlashIds((prev) => {
        const merged = new Set(prev);
        for (const id of fresh) merged.add(id);
        return merged;
      });
      window.setTimeout(() => {
        setFlashIds((prev) => {
          const nextSet = new Set(prev);
          for (const id of fresh) nextSet.delete(id);
          return nextSet;
        });
      }, 1600);
    } else {
      for (const id of catalysts.map((c) => c.id)) knownIds.current.add(id);
    }
  }, [catalysts]);

  const handleManualRefresh = useCallback(() => {
    if (manualRefreshing) return;
    setManualRefreshing(true);
    const minSpinMs = 500;
    const startedAt = Date.now();
    void refresh()
      .then(() => {
        if (pollErrorRef.current) {
          toast.error(pollErrorRef.current);
        }
      })
      .finally(() => {
        const elapsed = Date.now() - startedAt;
        window.setTimeout(
          () => setManualRefreshing(false),
          Math.max(0, minSpinMs - elapsed),
        );
      });
  }, [manualRefreshing, refresh]);

  useEffect(() => {
    const syncPresence = () => setPresence(readPresence());
    syncPresence();

    document.addEventListener("visibilitychange", syncPresence);
    window.addEventListener("focus", syncPresence);
    window.addEventListener("blur", syncPresence);

    return () => {
      document.removeEventListener("visibilitychange", syncPresence);
      window.removeEventListener("focus", syncPresence);
      window.removeEventListener("blur", syncPresence);
    };
  }, []);

  useEffect(() => {
    if (presence === "hidden") return;

    const intervalMs = presence === "active" ? ACTIVE_POLL_MS : BLURRED_POLL_MS;

    const immediateId =
      presence === "active"
        ? window.setTimeout(() => {
            void refresh({ silent: true });
          }, 0)
        : null;

    const id = window.setInterval(() => {
      void refresh({ silent: true });
    }, intervalMs);

    return () => {
      if (immediateId !== null) window.clearTimeout(immediateId);
      window.clearInterval(id);
    };
  }, [presence, refresh]);

  const toggleQuietMode = useCallback(async () => {
    const next = !quietMode;
    setQuietMode(next);
    try {
      await fetch("/api/playbook", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories: playbookCategories,
          quietMode: next,
        }),
      });
    } catch {
      setQuietMode(!next);
    }
  }, [quietMode, playbookCategories]);

  const dismissCatalyst = useCallback((id: number) => {
    // Two-phase removal: mark "dismissing" first so the row can play its
    // exit animation (`.row-dismiss`, mirroring `.feed-row`'s entrance),
    // then actually drop it from the list once that animation has had time
    // to finish - otherwise it would just vanish instantly.
    setDismissingIds((prev) => new Set(prev).add(id));
    setSelectedId((cur) => (cur === id ? null : cur));
    window.setTimeout(() => {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        writeDismissedIds(next);
        return next;
      });
      setDismissingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 260);
  }, []);

  const openSplit = useCallback((id: number) => {
    setSelectedId(id);
  }, []);

  const openArticle = useCallback(
    (id: number) => {
      router.push(`/dashboard/catalyst/${id}`);
    },
    [router],
  );

  const filterToTicker = useCallback(
    (ticker: string) => {
      patchFilters({ tickerQuery: ticker.trim().toUpperCase() });
      setFiltersOpen(true);
    },
    [patchFilters],
  );

  // Keep `?c=` in sync with the open row so article / browser back lands on
  // the same catalyst instead of a blank tape.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.pathname.startsWith("/dashboard")) return;
    const current = url.searchParams.get("c");
    const next = selectedId != null ? String(selectedId) : null;
    if (current === next) return;
    if (next) url.searchParams.set("c", next);
    else url.searchParams.delete("c");
    const qs = url.searchParams.toString();
    const href = qs ? `${url.pathname}?${qs}` : url.pathname;
    window.history.replaceState(window.history.state, "", href);
  }, [selectedId]);

  const prefetchQuote = useCallback(
    (id: number) => {
      const row = catalysts.find((c) => c.id === id);
      const ticker = row?.ticker?.trim().toUpperCase();
      if (!ticker) return;
      void fetch(`/api/market/quote?symbol=${encodeURIComponent(ticker)}`, {
        credentials: "same-origin",
      });
    },
    [catalysts],
  );

  const quietAddTicker = useCallback(
    async (ticker: string | null) => {
      const t = ticker?.trim().toUpperCase();
      if (!t) return;
      if (watchlistTickers.includes(t)) return;
      setWatchlistTickers((prev) =>
        prev.includes(t) ? prev : [...prev, t].sort(),
      );
      try {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker: t }),
        });
        if (!res.ok) {
          setWatchlistTickers((prev) => prev.filter((x) => x !== t));
        }
      } catch {
        setWatchlistTickers((prev) => prev.filter((x) => x !== t));
      }
    },
    [watchlistTickers],
  );

  const handleQuiet = useCallback(
    async (ticker: string | null) => {
      const t = ticker?.trim().toUpperCase();
      if (!t) return;
      const wasOnWatchlist = watchlistTickers.includes(t);
      if (!wasOnWatchlist) {
        await quietAddTicker(t);
      }
      if (!quietMode) {
        setQuietMode(true);
        try {
          await fetch("/api/playbook", {
            method: "PUT",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              categories: playbookCategories,
              quietMode: true,
            }),
          });
          toast.success(
            wasOnWatchlist
              ? "Quiet playbook enabled — watchlist + playbook categories only"
              : "Added to watchlist · Quiet playbook enabled",
          );
        } catch {
          setQuietMode(false);
          toast.error("Could not enable quiet playbook");
        }
      } else if (!wasOnWatchlist) {
        toast.success("Added to watchlist");
      }
    },
    [quietAddTicker, quietMode, watchlistTickers, playbookCategories],
  );

  const facetOptions = useMemo(() => buildFacetOptions(facets), [facets]);

  const visible = useMemo(() => {
    return catalysts.filter((c) => {
      if (dismissedIds.has(c.id)) return false;
      return matchesQuietPlaybook(
        { ticker: c.ticker, eventCategory: c.eventCategory },
        { quietMode, watchlistTickers, playbookCategories },
      );
    });
  }, [
    catalysts,
    dismissedIds,
    quietMode,
    watchlistTickers,
    playbookCategories,
  ]);

  const selected = selectedId
    ? (catalysts.find((c) => c.id === selectedId) ?? null)
    : null;

  const panelFiltersActive = !isFiltersDefault(filterState);
  const filtersActive = panelFiltersActive || quietMode;

  const emptyKind = classifyFeedEmpty({
    catalystCount: catalysts.length,
    visibleCount: visible.length,
    loading,
    filtersDefault: isFiltersDefault(filterState),
    quietMode,
    timeWindow: filterState.timeWindow,
  });

  // Compare ingest lag to the last successful poll clock (pure; no Date.now).
  const ingestStale =
    lastFetchedAt != null &&
    lastIngestedAt != null &&
    new Date(lastFetchedAt).getTime() - new Date(lastIngestedAt).getTime() >
      INGESTION_STALE_AFTER_MS;

  const lastUpdatedLabel = lastFetchedAt
    ? new Date(lastFetchedAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <section
      className="news-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]"
      aria-label="Catalyst Feed"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--desk-border)] bg-[var(--desk-header)] px-4 py-3.5 sm:px-5">
        <h1 className="text-[1.05rem] font-semibold tracking-tight text-[var(--desk-text)]">
          Catalyst Feed
        </h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => void toggleQuietMode()}
            disabled={!prefsLoaded}
            title="When on, only show catalysts for tickers on your watchlist that match your playbook event categories"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.82rem] font-medium transition-colors",
              quietMode
                ? "border-[var(--desk-live)]/45 bg-[var(--desk-live)]/10 text-[var(--desk-live)]"
                : "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)] hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]",
            )}
          >
            Quiet playbook
            {quietMode ? (
              <span className="size-1.5 rounded-full bg-[var(--desk-live)]" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.82rem] font-medium transition-colors",
              filtersOpen || filtersActive
                ? "border-[var(--desk-live)]/40 bg-[var(--desk-live)]/10 text-[var(--desk-live)]"
                : "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)] hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]",
            )}
          >
            <ListFilter className="size-3.5 text-[var(--desk-text-muted)]" />
            Filters
            {filtersActive ? (
              <span className="size-1.5 rounded-full bg-[var(--desk-live)]" />
            ) : null}
            <ChevronDown
              className={cn(
                "size-3.5 text-[var(--desk-text-muted)] transition-transform",
                filtersOpen && "rotate-180",
              )}
            />
          </button>
          {panelFiltersActive ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2.5 py-1.5 text-[0.82rem] font-medium text-[var(--desk-text-secondary)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
            >
              <X className="size-3.5 text-[var(--desk-text-muted)]" />
              Clear filters
            </button>
          ) : null}
          {lastUpdatedLabel ? (
            <span className="hidden font-mono text-[0.78rem] text-[var(--desk-text-dim)] tabular-nums sm:inline">
              Last updated: {lastUpdatedLabel}
            </span>
          ) : null}
          <button
            type="button"
            aria-label="Refresh"
            aria-busy={manualRefreshing}
            onClick={handleManualRefresh}
            disabled={manualRefreshing}
            className="btn-press grid size-[34px] place-items-center rounded-lg border border-[var(--desk-border-strong)] text-[var(--desk-text-muted)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)] disabled:cursor-default disabled:opacity-70"
          >
            <RefreshCw
              className={cn("size-4", manualRefreshing && "animate-spin")}
            />
          </button>
        </div>
      </div>

      {filtersOpen ? (
        <div className="border-b border-[var(--desk-border)] bg-[var(--desk-header)]/80 px-4 py-3 sm:px-5">
          <FeedFilters
            filterState={filterState}
            onPatchFilters={patchFilters}
            facetOptions={facetOptions}
            total={total}
            visibleCount={visible.length}
            quietMode={quietMode}
            watchlistCount={watchlistTickers.length}
            playbookCount={playbookCategories.length}
            panelFiltersActive={panelFiltersActive}
            onClearFilters={clearFilters}
          />
        </div>
      ) : null}

      {pollError ? (
        <p className="border-b border-[var(--desk-border)] px-4 py-2 font-mono text-xs text-[var(--desk-live)] sm:px-5">
          {pollError}
        </p>
      ) : null}

      {ingestStale && !pollError ? (
        <p className="border-b border-amber-500/35 bg-amber-500/10 px-4 py-2 font-mono text-xs text-amber-200 sm:px-5">
          Tape ingest looks stale
          {lastIngestedAt
            ? ` (last source fetch ${new Date(
                lastIngestedAt,
              ).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })})`
            : ""}
          . Cron or Admin fetch may be behind — event times below are still
          honest.
        </p>
      ) : null}

      <div
        className={cn(
          "flex min-h-0 flex-1",
          filterRecalc && "feed-filter-recalc",
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {emptyKind === "db" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <p className="text-sm font-medium text-[var(--desk-text)]">
                No catalysts yet
              </p>
              <p className="max-w-sm text-sm text-[var(--desk-text-muted)]">
                {isAdmin
                  ? "Open Admin and run “Fetch all sources now” to populate the Live feed."
                  : "Filings appear here once an admin runs the first ingestion job."}
              </p>
            </div>
          ) : emptyKind !== "none" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <p className="font-mono text-sm text-[var(--desk-text-muted)]">
                {emptyKind === "quiet"
                  ? "Quiet playbook: no watchlist/playbook matches right now."
                  : emptyKind === "time_window"
                    ? "No catalysts in this time window (filters by event time, not when Admin inserted the row)."
                    : "No rows match these filters."}
              </p>
              {emptyKind === "time_window" || emptyKind === "filters" ? (
                <button
                  type="button"
                  onClick={() => {
                    clearFilters();
                    setFiltersOpen(true);
                  }}
                  className="rounded-lg border border-[var(--desk-border-strong)] px-3 py-1.5 font-mono text-xs text-[var(--desk-text-secondary)] hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
                >
                  Clear filters · show All
                </button>
              ) : null}
            </div>
          ) : (
            <CatalystFeedList
              catalysts={visible}
              flashIds={flashIds}
              dismissingIds={dismissingIds}
              selectedId={selectedId}
              watchlistTickers={watchlistTickers}
              onSelect={openSplit}
              onRead={openArticle}
              onPrefetch={prefetchQuote}
              onAct={openSplit}
              onDismiss={dismissCatalyst}
              onQuiet={handleQuiet}
              onFilterToTicker={filterToTicker}
              quietMode={quietMode}
              restoreScrollToSelected={Boolean(initialSelectedId)}
              hasMore={Boolean(nextCursor)}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
            />
          )}
        </div>

        {selected ? (
          <>
            <button
              type="button"
              aria-label="Close panel backdrop"
              className="fixed inset-0 z-40 bg-black/55 lg:hidden"
              onClick={() => setSelectedId(null)}
            />
            <TapeSplitPanel
              key={selected.id}
              catalyst={selected}
              onClose={() => setSelectedId(null)}
              onDismiss={() => {
                if (selectedId !== null) dismissCatalyst(selectedId);
              }}
              onAiAnalyzed={(analysis) => {
                prependOrMerge([
                  {
                    ...selected,
                    aiBullets: analysis.bullets,
                    aiLean: analysis.lean,
                    aiUncertain: analysis.uncertain,
                  },
                ]);
              }}
              mobileOverlay
              className="fixed inset-0 z-50 w-full lg:static lg:inset-auto lg:z-auto lg:w-[min(52%,640px)] lg:min-w-[420px] lg:shrink-0 lg:border-l"
            />
          </>
        ) : null}
      </div>
    </section>
  );
}

interface FacetOptions {
  categories: { value: string; label: string; count?: number }[];
  sectors: { value: string; label: string; count?: number }[];
  forms: { value: string; label: string; count?: number }[];
  sources: { value: string; label: string; count?: number }[];
}

function buildFacetOptions(facets: FeedFacets | null): FacetOptions {
  return {
    categories: (facets?.categories ?? []).map((b) => ({
      value: b.key,
      label: CATEGORY_LABELS[b.key as EventCategoryKey] ?? b.key,
      count: b.count,
    })),
    sectors: (facets?.sectors ?? []).map((b) => ({
      value: b.key,
      label: gicsLabel(b.key as GicsSectorKey),
      count: b.count,
    })),
    forms: (facets?.forms ?? []).map((b) => ({
      value: b.key,
      label: FEED_FORM_LABELS[b.key as FeedFormFilter] ?? b.key,
      count: b.count,
    })),
    sources: (facets?.sources ?? []).map((b) => ({
      value: b.key,
      label: b.key,
      count: b.count,
    })),
  };
}

interface FeedFiltersProps {
  filterState: FeedFilterState;
  onPatchFilters: (patch: Partial<FeedFilterState>) => void;
  facetOptions: FacetOptions;
  total: number | null;
  visibleCount: number;
  quietMode: boolean;
  watchlistCount: number;
  playbookCount: number;
  panelFiltersActive: boolean;
  onClearFilters: () => void;
}

function FeedFilters({
  filterState,
  onPatchFilters,
  facetOptions,
  total,
  visibleCount,
  quietMode,
  watchlistCount,
  playbookCount,
  panelFiltersActive,
  onClearFilters,
}: FeedFiltersProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {quietMode ? (
        <p className="font-mono text-[0.72rem] text-[var(--desk-text-dim)]">
          Quiet playbook on · {watchlistCount} watchlist ticker
          {watchlistCount === 1 ? "" : "s"} · {playbookCount} categor
          {playbookCount === 1 ? "y" : "ies"} — edit under Watchlists / Alerts
          playbook.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={filterState.tickerQuery}
          onChange={(e) => onPatchFilters({ tickerQuery: e.target.value })}
          placeholder="Ticker, company, title…"
          aria-label="Search by ticker, company, or title"
          className="h-8 w-52 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs tracking-wide md:text-xs"
        />
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Filter by article posting time"
        >
          {FEED_TIME_WINDOWS.map((w) => (
            <FilterChip
              key={w.id}
              active={filterState.timeWindow === w.id}
              onClick={() => onPatchFilters({ timeWindow: w.id })}
            >
              {w.label}
            </FilterChip>
          ))}
        </div>
        {panelFiltersActive ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--desk-border)] px-2.5 font-mono text-[0.7rem] tracking-wide text-[var(--desk-text-muted)] transition-colors hover:border-[var(--desk-border-strong)] hover:text-[var(--desk-text)]"
          >
            <X className="size-3" />
            Clear
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FeedFilterMultiSelect
          label="Categories"
          options={facetOptions.categories}
          selected={filterState.categoryFilters}
          onChange={(categoryFilters) =>
            onPatchFilters({
              categoryFilters: categoryFilters as EventCategoryKey[],
            })
          }
          emptyLabel="All categories"
        />
        <FeedFilterMultiSelect
          label="Industries"
          options={facetOptions.sectors}
          selected={filterState.sectorFilters}
          onChange={(sectorFilters) =>
            onPatchFilters({
              sectorFilters: sectorFilters as GicsSectorKey[],
            })
          }
          emptyLabel="All industries"
        />
        <FeedFilterMultiSelect
          label="Form type"
          options={facetOptions.forms}
          selected={filterState.formFilters}
          onChange={(formFilters) =>
            onPatchFilters({
              formFilters: formFilters as FeedFormFilter[],
            })
          }
          emptyLabel="All forms"
        />
        <FeedFilterMultiSelect
          label="Source"
          options={facetOptions.sources}
          selected={filterState.sourceFilters}
          onChange={(sourceFilters) => onPatchFilters({ sourceFilters })}
          emptyLabel="All sources"
        />
      </div>
      {total != null ? (
        <p className="font-mono text-[0.68rem] text-[var(--desk-text-dim)] tabular-nums">
          Showing {visibleCount} of {total}
        </p>
      ) : null}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center rounded-md border px-2.5 font-mono text-[0.7rem] tracking-wide transition-colors",
        active
          ? "border-[var(--desk-text-dim)] bg-[var(--desk-overlay-strong)] text-[var(--desk-text)]"
          : "border-[var(--desk-border)] bg-transparent text-[var(--desk-text-muted)] hover:border-[var(--desk-border-strong)] hover:text-[var(--desk-text)]",
      )}
    >
      {children}
    </button>
  );
}

function CatalystFeedList({
  catalysts,
  flashIds,
  dismissingIds,
  selectedId,
  watchlistTickers,
  onSelect,
  onRead,
  onPrefetch,
  onAct,
  onDismiss,
  onQuiet,
  onFilterToTicker,
  quietMode,
  restoreScrollToSelected = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: {
  catalysts: FeedCatalyst[];
  flashIds: Set<number>;
  dismissingIds: Set<number>;
  selectedId: number | null;
  watchlistTickers: string[];
  onSelect: (id: number) => void;
  onRead: (id: number) => void;
  onPrefetch: (id: number) => void;
  onAct: (id: number) => void;
  onDismiss: (id: number) => void;
  onQuiet: (ticker: string | null) => void;
  onFilterToTicker: (ticker: string) => void;
  quietMode: boolean;
  /** One-shot scroll to the open row after returning from article. */
  restoreScrollToSelected?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const didRestoreScrollRef = useRef(false);
  // The feed's own scroll region (not `<main>` - it's sized to fit exactly,
  // see app-shell.tsx) needs to be focusable + focused on mount so Page
  // Up/Down/Home/End scroll it immediately, without requiring a prior click.
  useAutoFocusScrollRegion(listRef);

  useEffect(() => {
    if (!restoreScrollToSelected || selectedId == null) return;
    if (didRestoreScrollRef.current) return;
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-catalyst-id="${selectedId}"]`,
    );
    if (!row) return;
    didRestoreScrollRef.current = true;
    // nearest keeps the row in view without yanking the list to center.
    row.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [restoreScrollToSelected, selectedId, catalysts]);

  // "N new" pill: when the user has scrolled down, newly-arrived rows land
  // at the top of the tape (out of view) and their `.row-flash` never gets
  // seen. Tracking id membership across renders (independent of the
  // flash/dismiss bookkeeping above, which is about individual rows, not
  // "how many arrived while I wasn't looking") lets a single scroll-to-top
  // affordance surface them instead.
  const [atTop, setAtTop] = useState(true);
  const [pendingNew, setPendingNew] = useState(0);
  const knownListIds = useRef<Set<number>>(new Set(catalysts.map((c) => c.id)));

  // Warm the first visible article routes so a click often skips cold SSR.
  useEffect(() => {
    for (const c of catalysts.slice(0, 8)) {
      onPrefetch(c.id);
    }
    // Only when the top of the list identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalysts[0]?.id, catalysts[1]?.id, catalysts[2]?.id, catalysts[3]?.id]);

  useEffect(() => {
    const seen = knownListIds.current;
    const newOnes = catalysts.filter((c) => !seen.has(c.id));
    if (newOnes.length > 0 && !atTop) {
      setPendingNew((n) => n + newOnes.length);
    }
    knownListIds.current = new Set(catalysts.map((c) => c.id));
    // Only `catalysts` should retrigger the diff; `atTop` is read, not a
    // dependency we want re-running this on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalysts]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const nearTop = e.currentTarget.scrollTop < 40;
    setAtTop(nearTop);
    if (nearTop) setPendingNew(0);
  }, []);

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setPendingNew(0);
  }, []);

  useEffect(() => {
    if (!hasMore || !onLoadMore) return;
    const root = listRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) {
          void onLoadMore();
        }
      },
      { root, rootMargin: "240px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, loadingMore, catalysts.length]);

  return (
    <div
      ref={listRef}
      tabIndex={-1}
      onScroll={handleScroll}
      className="flex min-h-0 flex-1 flex-col overflow-auto outline-none"
      role="table"
      aria-label="News feed"
    >
      <div
        role="row"
        className={cn(
          "sticky top-0 z-[2] grid h-10 items-center gap-2 border-b border-[var(--desk-border-strong)] bg-[var(--desk-header)] px-4 font-mono text-[0.62rem] font-medium tracking-[0.12em] text-[var(--desk-text-dim)] uppercase shadow-[0_1px_0_rgba(0,0,0,0.35)] sm:gap-3 sm:px-5",
          FEED_GRID,
        )}
      >
        <div role="columnheader" className="col-span-1">
          Title
        </div>
        <div
          role="columnheader"
          className="hidden text-right sm:block"
          title="When the event occurred (ET) — not DB insert time"
        >
          Time
        </div>
        <div role="columnheader" className="hidden sm:block">
          Event
        </div>
        <div role="columnheader" className="hidden sm:block">
          Ticker
        </div>
        <div
          role="columnheader"
          className="col-start-5 hidden text-right lg:col-start-6 lg:block"
        >
          Action
        </div>
      </div>

      {pendingNew > 0 ? (
        <div className="sticky top-10 z-[2] flex justify-center pt-2">
          <button
            type="button"
            onClick={scrollToTop}
            className="btn-press pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-[rgba(240,193,75,0.45)] bg-[var(--desk-live)] px-3 py-1 font-mono text-[0.72rem] font-semibold tracking-wide text-[#121212] uppercase shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
          >
            <span className="live-pulse size-1.5 rounded-full bg-[#121212]" />
            {pendingNew} new
          </button>
        </div>
      ) : null}

      <div className="flex flex-col">
        {catalysts.map((catalyst, index) => {
          const flashing = flashIds.has(catalyst.id);
          const dismissing = dismissingIds.has(catalyst.id);
          const selected = selectedId === catalyst.id;
          const eventLabel = feedEventLabel(catalyst);
          const source = sourceDisplay(catalyst);
          const title = titleLine(catalyst);
          const onWatchlist = Boolean(
            catalyst.ticker &&
            watchlistTickers.includes(catalyst.ticker.toUpperCase()),
          );
          return (
            <article
              key={catalyst.id}
              data-catalyst-id={catalyst.id}
              role="row"
              tabIndex={0}
              onClick={() => onSelect(catalyst.id)}
              onMouseEnter={() => onPrefetch(catalyst.id)}
              onFocus={() => onPrefetch(catalyst.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(catalyst.id);
                }
              }}
              className={cn(
                "feed-row group relative grid min-h-[56px] cursor-pointer items-center gap-2 border-b border-[var(--desk-border)] px-4 py-3 transition-colors duration-150 outline-none sm:gap-3 sm:px-5 sm:py-0",
                FEED_GRID,
                "hover:bg-[var(--desk-overlay-soft)] focus-visible:bg-[var(--desk-overlay-soft)] focus-visible:shadow-[inset_2px_0_0_var(--desk-live)]",
                "hover:shadow-[inset_2px_0_0_rgba(240,193,75,0.35)]",
                selected && "bg-[var(--desk-overlay-strong)]",
                flashing && "row-flash",
                dismissing && "row-dismiss pointer-events-none",
              )}
              style={{
                animationDelay: dismissing
                  ? undefined
                  : `${Math.min(index, 28) * 22}ms`,
              }}
              aria-hidden={dismissing || undefined}
            >
              <div role="cell" className="min-w-0">
                <span
                  className="block truncate text-[0.86rem] font-medium tracking-tight text-[var(--desk-text-secondary)] transition-colors group-hover:text-[var(--desk-text)] group-focus-visible:text-[var(--desk-text)] max-sm:line-clamp-2 max-sm:whitespace-normal"
                  title={title}
                >
                  {title}
                </span>
                <span
                  className="mt-0.5 hidden truncate font-mono text-[0.62rem] tracking-wide text-[var(--desk-text-dim)] sm:block"
                  title={
                    catalyst.tags.length > 0
                      ? `${source.name} · ${catalyst.tags.slice(0, 3).join(" · ")}`
                      : source.name
                  }
                >
                  {source.name}
                  {catalyst.tags.length > 0
                    ? ` · ${catalyst.tags.slice(0, 3).join(" · ")}`
                    : ""}
                </span>
                {/* Mobile: Title → Time → Event, then ticker/actions */}
                <div className="mt-1.5 flex flex-col gap-1 sm:hidden">
                  <time
                    dateTime={catalyst.timestamp}
                    className="font-mono text-[0.72rem] font-medium tracking-tight whitespace-nowrap text-[var(--desk-text-muted)] tabular-nums"
                  >
                    {formatClockTime(catalyst.timestamp)}
                  </time>
                  <span className="font-mono text-[0.68rem] text-[var(--desk-text-dim)]">
                    {eventLabel}
                  </span>
                  {catalyst.ticker ? (
                    <TickerActionMenu
                      ticker={catalyst.ticker}
                      catalystId={catalyst.id}
                      onWatchlist={onWatchlist}
                      onFilterToTicker={() =>
                        onFilterToTicker(catalyst.ticker!)
                      }
                      onOpenPanel={() => onAct(catalyst.id)}
                      onAddWatchlist={() => onQuiet(catalyst.ticker)}
                      onDismiss={() => onDismiss(catalyst.id)}
                    />
                  ) : (
                    <span className="font-mono text-[0.8rem] font-semibold text-[var(--desk-text)]">
                      —
                    </span>
                  )}
                </div>
                {/* Touch: always-visible actions below meta/date (never same-line overlap). */}
                <div
                  className="mt-2 flex flex-wrap items-center gap-1.5 lg:hidden"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <FeedActionButton
                    variant="primary"
                    onClick={() => onRead(catalyst.id)}
                    title="Open full article"
                  >
                    <BookOpen className="size-3" />
                    Read
                  </FeedActionButton>
                  <FeedActionButton
                    onClick={() => onAct(catalyst.id)}
                    title="Open side panel (chart + triage)"
                  >
                    <Check className="size-3" />
                    Act
                  </FeedActionButton>
                  <FeedActionButton
                    onClick={() => onDismiss(catalyst.id)}
                    title="Hide from this tape (this browser). Not deleted."
                  >
                    <X className="size-3" />
                    Dismiss
                  </FeedActionButton>
                  {catalyst.ticker ? (
                    <FeedActionButton
                      onClick={() => onQuiet(catalyst.ticker)}
                      title="Add to watchlist and enable Quiet playbook (watchlist + playbook categories only)"
                      disabled={onWatchlist && quietMode}
                    >
                      <Plus className="size-3" />
                      Quiet
                    </FeedActionButton>
                  ) : null}
                </div>
              </div>

              <div
                role="cell"
                className="relative z-[1] hidden min-w-0 text-right sm:block"
              >
                <time
                  dateTime={catalyst.timestamp}
                  className="inline-block max-w-full font-mono text-[0.72rem] font-medium tracking-tight whitespace-nowrap text-[var(--desk-text-dim)] tabular-nums"
                  title={formatTimeDate(catalyst.timestamp)}
                >
                  {formatTimeDate(catalyst.timestamp)}
                </time>
              </div>

              <div role="cell" className="hidden min-w-0 sm:block">
                <span
                  className="inline-flex max-w-full truncate rounded-sm border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-1.5 py-0.5 font-mono text-[0.68rem] text-[var(--desk-text-secondary)]"
                  title={
                    catalyst.eventCategory
                      ? CATEGORY_LABELS[catalyst.eventCategory]
                      : undefined
                  }
                >
                  {eventLabel}
                </span>
              </div>

              <div role="cell" className="hidden min-w-0 sm:block">
                {catalyst.ticker ? (
                  <TickerActionMenu
                    ticker={catalyst.ticker}
                    catalystId={catalyst.id}
                    onWatchlist={onWatchlist}
                    onFilterToTicker={() => onFilterToTicker(catalyst.ticker!)}
                    onOpenPanel={() => onAct(catalyst.id)}
                    onAddWatchlist={() => onQuiet(catalyst.ticker)}
                    onDismiss={() => onDismiss(catalyst.id)}
                  />
                ) : (
                  <span className="truncate font-mono text-[0.88rem] font-semibold tracking-tight text-[var(--desk-text)]">
                    —
                  </span>
                )}
              </div>

              {/* Desktop: hover / focus-within reveals action toolbar in its own column */}
              <div
                role="cell"
                className="relative z-0 col-start-5 hidden min-w-0 justify-end overflow-hidden lg:col-start-6 lg:flex"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div
                  className={cn(
                    "flex w-full min-w-0 flex-nowrap items-center justify-end gap-1 opacity-0 transition-opacity duration-150",
                    "pointer-events-none group-hover:pointer-events-auto group-hover:opacity-100",
                    "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
                    selected && "pointer-events-auto opacity-100",
                  )}
                >
                  <FeedActionButton
                    variant="primary"
                    onClick={() => onRead(catalyst.id)}
                    title="Open full article"
                  >
                    <BookOpen className="size-3" />
                    Read
                  </FeedActionButton>
                  <FeedActionButton
                    onClick={() => onAct(catalyst.id)}
                    title="Open side panel (chart + triage)"
                  >
                    <Check className="size-3" />
                    Act
                  </FeedActionButton>
                  <FeedActionButton
                    onClick={() => onDismiss(catalyst.id)}
                    title="Hide from this tape (this browser). Not deleted."
                  >
                    <X className="size-3" />
                    Dismiss
                  </FeedActionButton>
                  {catalyst.ticker ? (
                    <FeedActionButton
                      onClick={() => onQuiet(catalyst.ticker)}
                      title="Add to watchlist and enable Quiet playbook (watchlist + playbook categories only)"
                      disabled={onWatchlist && quietMode}
                    >
                      <Plus className="size-3" />
                      Quiet
                    </FeedActionButton>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
        {hasMore ? (
          <div
            ref={sentinelRef}
            className="flex min-h-[48px] items-center justify-center py-3"
            aria-hidden
          >
            {loadingMore ? (
              <Loader2 className="size-4 animate-spin text-[var(--desk-text-dim)]" />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FeedActionButton({
  children,
  onClick,
  title,
  variant = "ghost",
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  title?: string;
  variant?: "primary" | "ghost";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-mono text-[0.65rem] font-semibold tracking-wide uppercase transition-[background-color,border-color,color,filter,opacity] duration-100",
        variant === "primary"
          ? "bg-[var(--desk-live)] text-[#121212] hover:brightness-110"
          : "border border-[var(--desk-border-strong)] text-[var(--desk-text-muted)] hover:border-[var(--desk-text-dim)] hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]",
        disabled &&
          "cursor-default opacity-45 hover:bg-transparent hover:brightness-100",
      )}
    >
      {children}
    </button>
  );
}
