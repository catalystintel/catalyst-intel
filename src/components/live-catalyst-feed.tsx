"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  ChevronDown,
  ListFilter,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { CatalystArticleDialog } from "@/components/catalyst-article-dialog";
import { DeskTip } from "@/components/desk-tip";
import { FeedFilterMultiSelect } from "@/components/feed-filter-multi-select";
import { TapeSplitPanel } from "@/components/tape-split-panel";
import { SymbolActionMenu } from "@/components/symbol-action-menu";
import { Input } from "@/components/ui/input";
import { useAutoFocusScrollRegion } from "@/hooks/use-auto-focus-scroll-region";
import { useLiveFeedQuery } from "@/hooks/use-live-feed-query";
import {
  sortFeedNewestFirst,
  type FeedCatalyst,
} from "@/lib/catalysts/feed-catalyst";
import {
  titleLine,
  titleTooltipLine,
  eventLabel as feedEventLabel,
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
import { passesSymbolFeedGate } from "@/lib/catalysts/symbol-feed-gate";
import { isLocalDevUi, LOCAL_DEV_ONLY_LABEL } from "@/lib/dev/local-dev-ui";
import {
  isFiltersDefault,
  isPanelFiltersDefault,
  readPersistedFeedFilters,
  touchPersistedFeedFilters,
  writePersistedFeedFilters,
  type FeedFilterState,
} from "@/lib/catalysts/feed-filter-persist";
import {
  FEED_FORM_LABELS,
  type FeedFormFilter,
} from "@/lib/catalysts/feed-form-filters";
import type { FeedFacets } from "@/lib/catalysts/feed-query-types";
import { gicsLabel, type GicsSectorKey } from "@/lib/companies/gics-sectors";
import { formatClockTime, formatTimeDate } from "@/lib/format/relative-time";
import { cn } from "@/lib/utils";

export type { FeedCatalyst };

/** Soft-refetch while the tab is focused — keeps the tape current without a stale banner. */
const ACTIVE_POLL_MS = 15_000;
/** Slower poll when the window is blurred but still visible. */
const BLURRED_POLL_MS = 90_000;
const DISMISS_STORAGE_KEY = "ci.dismissed-catalyst-ids";

type Presence = "active" | "blurred" | "hidden";

/**
 * Blotter: Symbol · Title · Time (+ Action toolbar).
 * Symbol leads as the row index. No Event / Source primary columns.
 * Time = event occurrence in the viewer's local timezone.
 *
 * Time/Action use fixed tracks so `5:31 PM GMT+3 · Jul 24, 2026` (Plex Mono)
 * fits under Time. Desktop Action buttons stay hover/focus/selected-only so
 * the tape stays quiet until the row is engaged.
 */
const FEED_GRID =
  "grid-cols-[4.5rem_minmax(0,1fr)] sm:grid-cols-[5rem_minmax(0,1fr)_15.5rem] lg:grid-cols-[5rem_minmax(0,1fr)_15.5rem_16rem]";

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
  initialSymbolFilter,
  initialSelectedId,
  onFocusSymbol,
}: {
  initialCatalysts: FeedCatalyst[];
  isAdmin: boolean;
  /** Pre-fills the symbol filter, e.g. arriving via `?symbol=` from Analytics. */
  initialSymbolFilter?: string;
  /** Re-opens the split panel, e.g. arriving via `?c=` after details. */
  initialSelectedId?: number;
  /**
   * Fired with the resolved symbol whenever the split panel opens on a row
   * that has one — lets a dashboard-level Charting panel stay in sync with
   * whichever tape row you're triaging, alongside the split panel's own
   * inline chart. Optional; no-op when omitted (unchanged behavior).
   */
  onFocusSymbol?: (symbol: string) => void;
}) {
  const query = useLiveFeedQuery(initialCatalysts, {
    symbolQuery: initialSymbolFilter?.trim() ?? "",
  });
  const {
    catalysts,
    total,
    facets,
    nextCursor,
    loading,
    loadingMore,
    lastFetchedAt,
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
  const [filtersOpen, setFiltersOpen] = useState(Boolean(initialSymbolFilter));
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [filterRecalc, setFilterRecalc] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(() =>
    readDismissedIds(),
  );
  const [dismissingIds, setDismissingIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);
  const [playbookCategories, setPlaybookCategories] = useState<
    EventCategoryKey[]
  >(DEFAULT_PLAYBOOK_CATEGORIES);
  const [quietMode, setQuietMode] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [articleId, setArticleId] = useState<number | null>(null);
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
          const symbols = (wData.symbols ?? []).map(
            (t: { symbol: string }) => t.symbol,
          );
          setWatchlistSymbols(symbols);
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
  // mismatch). Deep-link `?symbol=` wins for the symbol field; other saved
  // filters still apply when still within the idle window.
  useEffect(() => {
    const restoreId = window.setTimeout(() => {
      const saved = readPersistedFeedFilters();
      const urlSymbol = initialSymbolFilter?.trim() ?? "";
      // Source facet is local-dev only — never restore vendor filters in deploy.
      const sanitize = (filters: FeedFilterState): FeedFilterState =>
        isLocalDevUi() ? filters : { ...filters, sourceFilters: [] };

      if (urlSymbol) {
        setFilterState((prev) => ({
          ...prev,
          symbolQuery: urlSymbol,
          ...(saved
            ? sanitize({
                ...prev,
                categoryFilters: saved.categoryFilters,
                sectorFilters: saved.sectorFilters,
                formFilters: saved.formFilters,
                sourceFilters: saved.sourceFilters,
                timeWindow: saved.timeWindow,
                symbolOnly: saved.symbolOnly,
                symbolQuery: urlSymbol,
              })
            : {}),
          // Desk rule is always on (CPI / Jobs excepted).
          symbolOnly: true,
        }));
        setFiltersOpen(true);
      } else if (saved) {
        const restored = { ...sanitize(saved), symbolOnly: true };
        setFilterState(restored);
        if (!isPanelFiltersDefault(restored)) setFiltersOpen(true);
      }
      setFiltersHydrated(true);
    }, 0);
    return () => window.clearTimeout(restoreId);
  }, [initialSymbolFilter, setFilterState]);

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

  const undismissCatalyst = useCallback((id: number) => {
    setDismissedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      writeDismissedIds(next);
      return next;
    });
    setDismissingIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const dismissCatalyst = useCallback(
    (id: number) => {
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
        toast.message("Hidden from results", {
          action: {
            label: "Undo",
            onClick: () => undismissCatalyst(id),
          },
        });
      }, 260);
    },
    [undismissCatalyst],
  );

  const openSplit = useCallback((id: number) => {
    setSelectedId(id);
  }, []);

  const openArticle = useCallback((id: number) => {
    setArticleId(id);
  }, []);

  const filterToSymbol = useCallback(
    (symbol: string) => {
      patchFilters({ symbolQuery: symbol.trim().toUpperCase() });
      setFiltersOpen(true);
    },
    [patchFilters],
  );

  // Keep `?c=` in sync with the open row so article / browser back lands on
  // the same catalyst instead of a blank tape.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.pathname.startsWith("/catalyst-feed")) return;
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
      const symbol = row?.symbol?.trim().toUpperCase();
      if (!symbol) return;
      void fetch(`/api/market/quote?symbol=${encodeURIComponent(symbol)}`, {
        credentials: "same-origin",
      });
    },
    [catalysts],
  );

  const quietAddSymbol = useCallback(
    async (symbol: string | null): Promise<boolean> => {
      const t = symbol?.trim().toUpperCase();
      if (!t) return false;
      if (watchlistSymbols.includes(t)) return true;
      setWatchlistSymbols((prev) =>
        prev.includes(t) ? prev : [...prev, t].sort(),
      );
      try {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol: t }),
        });
        if (!res.ok) {
          setWatchlistSymbols((prev) => prev.filter((x) => x !== t));
          return false;
        }
        return true;
      } catch {
        setWatchlistSymbols((prev) => prev.filter((x) => x !== t));
        return false;
      }
    },
    [watchlistSymbols],
  );

  const handleQuiet = useCallback(
    async (symbol: string | null) => {
      const t = symbol?.trim().toUpperCase();
      if (!t) return;
      if (watchlistSymbols.includes(t)) {
        toast.message(`${t} is already on your watchlist`);
        return;
      }
      const ok = await quietAddSymbol(t);
      if (ok) toast.success(`${t} added to watchlist`);
      else toast.error(`Could not add ${t} to watchlist`);
    },
    [quietAddSymbol, watchlistSymbols],
  );

  const facetOptions = useMemo(() => buildFacetOptions(facets), [facets]);

  const visible = useMemo(() => {
    const filtered = catalysts.filter((c) => {
      if (dismissedIds.has(c.id)) return false;
      return matchesQuietPlaybook(
        { symbol: c.symbol, eventCategory: c.eventCategory },
        { quietMode, watchlistSymbols, playbookCategories },
      );
    });
    // Always newest → oldest (event time), even after client overlays.
    return sortFeedNewestFirst(filtered);
  }, [
    catalysts,
    dismissedIds,
    quietMode,
    watchlistSymbols,
    playbookCategories,
  ]);

  const selectedRaw = selectedId
    ? (catalysts.find((c) => c.id === selectedId) ?? null)
    : null;
  // Desk rule: don't open the split panel for unresolved names
  // (CPI / Jobs NFP macro exceptions may still open without a symbol).
  const selected =
    selectedRaw && passesSymbolFeedGate(selectedRaw) ? selectedRaw : null;

  // Keep an external dashboard Charting panel (if any) pointed at whatever
  // row is currently open — additive, no-op without `onFocusSymbol`.
  useEffect(() => {
    if (selected?.symbol) onFocusSymbol?.(selected.symbol);
  }, [selected, onFocusSymbol]);

  // Symbol-only is a header toggle — don't drive Clear / Filters badge from it.
  const panelFiltersActive = !isPanelFiltersDefault(filterState);
  const filtersActive = panelFiltersActive || quietMode;

  const emptyKind = classifyFeedEmpty({
    catalystCount: catalysts.length,
    visibleCount: visible.length,
    loading,
    filtersDefault: isFiltersDefault(filterState),
    quietMode,
    timeWindow: filterState.timeWindow,
  });

  const refreshedLabel = lastFetchedAt
    ? new Date(lastFetchedAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <section
      className="news-panel desk-arial flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]"
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
            title="When on, only show catalysts for symbols on your watchlist that match your playbook event categories"
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
          {refreshedLabel ? (
            <span
              className="hidden font-mono text-[0.78rem] text-[var(--desk-text-muted)] tabular-nums sm:inline"
              title="When this browser last refreshed the feed — not when filings occurred"
            >
              Refreshed: {refreshedLabel}
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
            watchlistCount={watchlistSymbols.length}
            playbookCount={playbookCategories.length}
            panelFiltersActive={panelFiltersActive}
            onClearFilters={clearFilters}
          />
        </div>
      ) : null}

      {pollError ? (
        <p className="border-b border-[var(--desk-border)] px-4 py-2 text-xs text-[var(--desk-live)] sm:px-5">
          {pollError}
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
                Catalysts appear here once the desk is populated.
              </p>
            </div>
          ) : emptyKind !== "none" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              {emptyKind === "time_window" ? (
                <>
                  <p className="text-sm font-medium text-[var(--desk-text)]">
                    Nothing in this time window
                  </p>
                  <p className="max-w-md text-sm text-pretty text-[var(--desk-text-muted)]">
                    The tape lists events by when they happened — not when we
                    last fetched. New ingest can still be older filings. Widen
                    the window or show All.
                  </p>
                </>
              ) : (
                <p className="text-sm text-[var(--desk-text-muted)]">
                  {emptyKind === "quiet"
                    ? "Quiet playbook: no watchlist/playbook matches right now."
                    : "No rows match these filters."}
                </p>
              )}
              {emptyKind === "time_window" || emptyKind === "filters" ? (
                <button
                  type="button"
                  onClick={() => {
                    clearFilters();
                    setFiltersOpen(true);
                  }}
                  className="rounded-lg border border-[var(--desk-border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--desk-text-secondary)] hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
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
              watchlistSymbols={watchlistSymbols}
              onSelect={openSplit}
              onRead={openArticle}
              onPrefetch={prefetchQuote}
              onAct={openSplit}
              onDismiss={dismissCatalyst}
              onQuiet={handleQuiet}
              onFilterToSymbol={filterToSymbol}
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
              isAdmin={isAdmin}
              onClose={() => setSelectedId(null)}
              onRead={() => openArticle(selected.id)}
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

      <CatalystArticleDialog
        catalystId={articleId}
        isAdmin={isAdmin}
        open={articleId != null}
        onOpenChange={(next) => {
          if (!next) setArticleId(null);
        }}
      />
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
          Quiet playbook on · {watchlistCount} watchlist symbol
          {watchlistCount === 1 ? "" : "s"} · {playbookCount} categor
          {playbookCount === 1 ? "y" : "ies"} — edit under Watchlists.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={filterState.symbolQuery}
          onChange={(e) => onPatchFilters({ symbolQuery: e.target.value })}
          placeholder="Symbol, company, title…"
          aria-label="Search by symbol, company, or title"
          className="h-8 w-52 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs tracking-wide md:text-xs"
        />
        <div
          className="flex flex-wrap items-center gap-1"
          role="group"
          aria-label="Filter by event posting time"
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
        {isLocalDevUi() ? (
          <FeedFilterMultiSelect
            label={`Source ${LOCAL_DEV_ONLY_LABEL}`}
            options={facetOptions.sources}
            selected={filterState.sourceFilters}
            onChange={(sourceFilters) => onPatchFilters({ sourceFilters })}
            emptyLabel="All sources"
          />
        ) : null}
      </div>
      {total != null ? (
        <p className="text-[0.75rem] text-[var(--desk-text-dim)] tabular-nums">
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
  watchlistSymbols,
  onSelect,
  onRead,
  onPrefetch,
  onAct,
  onDismiss,
  onQuiet,
  onFilterToSymbol,
  restoreScrollToSelected = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: {
  catalysts: FeedCatalyst[];
  flashIds: Set<number>;
  dismissingIds: Set<number>;
  selectedId: number | null;
  watchlistSymbols: string[];
  onSelect: (id: number) => void;
  onRead: (id: number) => void;
  onPrefetch: (id: number) => void;
  onAct: (id: number) => void;
  onDismiss: (id: number) => void;
  onQuiet: (symbol: string | null) => void;
  onFilterToSymbol: (symbol: string) => void;
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

  // Warm the first visible details routes so a click often skips cold SSR.
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
          "sticky top-0 z-[2] grid h-10 items-center gap-2 border-b border-[var(--desk-border-strong)] bg-[var(--desk-header)] px-4 font-mono text-[0.62rem] font-medium tracking-[0.12em] text-[var(--desk-text-muted)] uppercase shadow-[0_1px_0_rgba(0,0,0,0.35)] sm:gap-3 sm:px-5 lg:gap-5",
          FEED_GRID,
        )}
      >
        <div role="columnheader" className="min-w-0">
          Symbol
        </div>
        <div role="columnheader" className="min-w-0">
          Title
        </div>
        <div
          role="columnheader"
          className="hidden min-w-0 sm:block"
          title="When the event occurred (your local time) — not when we fetched it"
        >
          Time
        </div>
        <div
          role="columnheader"
          className="hidden justify-self-end pl-1 text-right lg:block"
        >
          Actions
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
          const title = titleLine(catalyst);
          const tooltipTitle = titleTooltipLine(catalyst);
          const onWatchlist = Boolean(
            catalyst.symbol &&
            watchlistSymbols.includes(catalyst.symbol.toUpperCase()),
          );
          const renderSymbol = () =>
            catalyst.symbol ? (
              <SymbolActionMenu
                symbol={catalyst.symbol}
                companyName={catalyst.companyName}
                catalystId={catalyst.id}
                onWatchlist={onWatchlist}
                onFilterToSymbol={() => onFilterToSymbol(catalyst.symbol!)}
                onOpenPanel={() => onAct(catalyst.id)}
                onOpenArticle={() => onRead(catalyst.id)}
                onAddWatchlist={() => onQuiet(catalyst.symbol)}
                onDismiss={() => onDismiss(catalyst.id)}
              />
            ) : (
              <span className="truncate font-mono text-[0.88rem] font-semibold tracking-tight text-[var(--desk-text-dim)]">
                —
              </span>
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
                "feed-row group relative grid min-h-[56px] cursor-pointer items-center gap-2 border-b border-[var(--desk-border)] px-4 py-3 transition-colors duration-150 outline-none sm:gap-3 sm:px-5 sm:py-0 lg:gap-5",
                FEED_GRID,
                "hover:bg-[var(--desk-overlay-soft)] focus-visible:bg-[var(--desk-overlay-soft)] focus-visible:shadow-[inset_2px_0_0_var(--desk-live)]",
                "hover:shadow-[inset_2px_0_0_rgba(240,193,75,0.35)]",
                selected && "bg-[var(--desk-overlay-strong)]",
                flashing && "row-flash",
                dismissing && "row-dismiss pointer-events-none",
              )}
              style={{
                // Cap stagger — long delays + fill-mode left lower rows faded.
                animationDelay: dismissing
                  ? undefined
                  : index < 10
                    ? `${index * 16}ms`
                    : "0ms",
              }}
              aria-hidden={dismissing || undefined}
            >
              <div role="cell" className="relative z-[1] min-w-0">
                {renderSymbol()}
              </div>

              <div role="cell" className="min-w-0">
                <FeedTitleWithTooltip
                  title={title}
                  tooltipTitle={tooltipTitle}
                  companyName={catalyst.companyName}
                  eventLabel={eventLabel}
                  symbol={catalyst.symbol}
                />
                {/* Mobile: Time under Title (Symbol is the leading index col) */}
                <div className="mt-1.5 flex flex-col gap-1 sm:hidden">
                  <time
                    dateTime={catalyst.timestamp}
                    className="font-mono text-[0.72rem] font-medium tracking-tight whitespace-nowrap text-[var(--desk-text-muted)] tabular-nums"
                  >
                    {formatClockTime(catalyst.timestamp)}
                  </time>
                </div>
                {/* Touch: always-visible actions below meta (never same-line overlap). */}
                <div
                  className="mt-2 flex flex-wrap items-center gap-1.5 lg:hidden"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <FeedActionButton
                    variant="primary"
                    onClick={() => onRead(catalyst.id)}
                    tip="Open event details"
                  >
                    <BookOpen className="size-3" />
                    Details
                  </FeedActionButton>
                  <FeedActionButton
                    onClick={() => onDismiss(catalyst.id)}
                    tip="Hide from results"
                  >
                    <X className="size-3" />
                    Dismiss
                  </FeedActionButton>
                  {catalyst.symbol ? (
                    <FeedActionButton
                      onClick={() => onQuiet(catalyst.symbol)}
                      tip={
                        onWatchlist
                          ? "Already on your watchlist"
                          : "Add to watchlist"
                      }
                      disabled={onWatchlist}
                    >
                      <Plus className="size-3" />
                      Watch
                    </FeedActionButton>
                  ) : null}
                </div>
              </div>

              <div
                role="cell"
                className="relative z-[1] hidden min-w-0 sm:block"
              >
                <time
                  dateTime={catalyst.timestamp}
                  className="block font-mono text-[0.72rem] font-medium tracking-tight whitespace-nowrap text-[var(--desk-text-muted)] tabular-nums"
                  title={formatTimeDate(catalyst.timestamp)}
                >
                  {formatTimeDate(catalyst.timestamp)}
                </time>
              </div>

              {/* Desktop: actions appear on row hover / focus / selection. */}
              <div
                role="cell"
                className="relative z-0 hidden min-w-0 justify-end justify-self-end overflow-hidden pl-1 lg:flex"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div
                  className={cn(
                    "flex w-full min-w-0 flex-nowrap items-center justify-end gap-1.5 transition-opacity duration-100",
                    "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
                    selected && "opacity-100",
                  )}
                >
                  <FeedActionButton
                    variant="primary"
                    onClick={() => onRead(catalyst.id)}
                    tip="Open event details"
                  >
                    <BookOpen className="size-3" />
                    Details
                  </FeedActionButton>
                  <FeedActionButton
                    onClick={() => onDismiss(catalyst.id)}
                    tip="Hide from results"
                  >
                    <X className="size-3" />
                    Dismiss
                  </FeedActionButton>
                  {catalyst.symbol ? (
                    <FeedActionButton
                      onClick={() => onQuiet(catalyst.symbol)}
                      tip={
                        onWatchlist
                          ? "Already on your watchlist"
                          : "Add to watchlist"
                      }
                      disabled={onWatchlist}
                    >
                      <Plus className="size-3" />
                      Watch
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

function FeedTitleWithTooltip({
  title,
  tooltipTitle,
  companyName,
  eventLabel,
  symbol,
}: {
  title: string;
  /** Longer filing blurb for hover (not the truncated tape line). */
  tooltipTitle: string;
  companyName: string | null;
  eventLabel: string;
  symbol: string | null;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    maxWidth: number;
  } | null>(null);

  const company = companyName?.trim() || null;
  const normalizedSymbol = symbol?.trim().toUpperCase() || null;
  const meta = [normalizedSymbol, company, eventLabel]
    .filter(Boolean)
    .join(" · ");
  const tip = tooltipTitle.trim() || title;

  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 12;
    const maxWidth = Math.min(560, window.innerWidth - pad * 2);
    const left = Math.min(
      Math.max(pad, r.left),
      window.innerWidth - maxWidth - pad,
    );
    // Prefer below the title; flip above when near the bottom of the viewport.
    const below = r.bottom + 8;
    const estimatedHeight = 120;
    const top =
      below + estimatedHeight > window.innerHeight - pad
        ? Math.max(pad, r.top - estimatedHeight - 8)
        : below;
    setCoords({ top, left, maxWidth });
  }, []);

  const hide = useCallback(() => setCoords(null), []);

  useEffect(() => {
    if (!coords) return;
    const onReposition = () => hide();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [coords, hide]);

  return (
    <span
      ref={anchorRef}
      className="block min-w-0"
      onMouseEnter={place}
      onMouseLeave={hide}
      onFocus={place}
      onBlur={hide}
    >
      <span className="feed-article-title block truncate text-[0.86rem] tracking-tight text-[var(--desk-text-secondary)] transition-colors group-hover:text-[var(--desk-text)] group-focus-visible:text-[var(--desk-text)] max-sm:line-clamp-2 max-sm:whitespace-normal">
        {title}
      </span>
      {coords
        ? createPortal(
            <span
              role="tooltip"
              style={{
                top: coords.top,
                left: coords.left,
                maxWidth: coords.maxWidth,
              }}
              className={cn(
                "desk-arial pointer-events-none fixed z-[80] w-max",
                "rounded-md border border-[var(--desk-border-strong)] bg-[var(--desk-panel)] px-2.5 py-2",
                "shadow-[0_12px_32px_rgba(0,0,0,0.5)]",
              )}
            >
              <span className="feed-article-title block text-[0.8rem] leading-snug break-words whitespace-normal text-[var(--desk-text)]">
                {tip}
              </span>
              {meta ? (
                <span className="mt-1 block font-mono text-[0.65rem] leading-snug tracking-wide text-[var(--desk-text-muted)]">
                  {meta}
                </span>
              ) : null}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

function FeedActionButton({
  children,
  onClick,
  tip,
  variant = "ghost",
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  tip: string;
  variant?: "primary" | "ghost";
  disabled?: boolean;
}) {
  return (
    <DeskTip side="top" content={tip}>
      <button
        type="button"
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
    </DeskTip>
  );
}
