"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowUp,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ListFilter,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { CatalystArticleDialog } from "@/components/catalyst-article-dialog";
import { DeskTip } from "@/components/desk-tip";
import { FeedFilterMultiSelect } from "@/components/feed-filter-multi-select";
import { TapeChartPanel } from "@/components/tape-chart-panel";
import { TapeSplitPanel } from "@/components/tape-split-panel";
import { SymbolActionMenu } from "@/components/symbol-action-menu";
import {
  AddToWatchlistButton,
  type WatchlistDestination,
} from "@/components/watchlists/add-to-watchlist-menu";
import {
  WatchlistEditorDialog,
  type WatchlistDraft,
} from "@/components/watchlists/watchlist-editor-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAutoFocusScrollRegion } from "@/hooks/use-auto-focus-scroll-region";
import { useLiveFeedQuery } from "@/hooks/use-live-feed-query";
import {
  sortFeedNewestFirst,
  type FeedCatalyst,
} from "@/lib/catalysts/feed-catalyst";
import {
  sourceDisplay,
  titleLine,
  titleTooltipLine,
  eventLabel as feedEventLabel,
} from "@/lib/catalysts/feed-display";
import {
  matchesQuietPlaybook,
  type QuietSignalWatchlist,
} from "@/lib/catalysts/playbook";
import {
  CATEGORY_LABELS,
  type EventCategoryKey,
} from "@/lib/jobs/parse-8k-items";
import { FEED_TIME_WINDOWS } from "@/lib/catalysts/feed-time-window";
import { classifyFeedEmpty } from "@/lib/catalysts/feed-empty-state";
import { passesSymbolFeedGate } from "@/lib/catalysts/symbol-feed-gate";
import { isLocalDevUi } from "@/lib/dev/local-dev-ui";
import {
  DEFAULT_CHART_RANGE,
  type ChartRangeKey,
} from "@/lib/market/chart-range";
import {
  DEFAULT_FEED_FILTERS,
  filtersToWatchlistCriteria,
  isFiltersDefault,
  isPanelFiltersDefault,
  readPersistedFeedFilters,
  touchPersistedFeedFilters,
  watchlistCriteriaToFilters,
  writePersistedFeedFilters,
  type FeedFilterState,
} from "@/lib/catalysts/feed-filter-persist";
import type { WatchlistCriteria } from "@/db/schema";
import { writeWatchlistDraftHandoff } from "@/lib/watchlist/draft-handoff";
import type { FeedFacets } from "@/lib/catalysts/feed-query-types";
import {
  formatClockTime,
  formatEventTimeParts,
  formatTimeDate,
} from "@/lib/format/relative-time";
import { cn } from "@/lib/utils";
import {
  notifyWatchlistChanged,
  subscribeWatchlistChanged,
} from "@/lib/watchlist/watchlist-events";

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
 * Time is two lines (`3:58 PM` / `Jul 29, 2026`) so the stamp stays inside
 * its track; zone stays on the hover title. Actions track fits Details +
 * Dismiss + Watch; if space is tight, secondary actions clip first so the
 * primary Details label never reads as “ETAILS”.
 * Desktop Action buttons stay hover/focus/selected-only so the tape stays
 * quiet until the row is engaged.
 */
// Title is the scan column — Time/Actions stay fixed; Title takes the rest.
// Tracks are sized for laptop (~1280–1512) without a right rail; avoid large
// minmax floors that force horizontal overflow when the docked split is open.
const FEED_GRID =
  "grid-cols-[4.5rem_minmax(0,1fr)] sm:grid-cols-[5rem_minmax(0,1fr)_6.5rem] lg:grid-cols-[5rem_minmax(0,1fr)_6.5rem_15rem]";
/** Denser tape columns while the split panel steals horizontal space. */
const FEED_GRID_SPLIT =
  "grid-cols-[4.5rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_minmax(0,1fr)] xl:grid-cols-[4.5rem_minmax(0,1fr)_5.75rem]";

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

/** `xl` breakpoint — docked split+chart vs mobile overlay. */
function useIsXlDesk() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia("(min-width: 1280px)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(min-width: 1280px)").matches,
    () => true,
  );
}

export function LiveCatalystFeed({
  initialCatalysts,
  isAdmin,
  showSourceLabels = false,
  initialSymbolFilter,
  initialWatchlistCriteria,
  initialSelectedId,
  onFocusSymbol,
  onSplitOpenChange,
  calendarRailHidden = false,
  onShowCalendarRail,
}: {
  initialCatalysts: FeedCatalyst[];
  isAdmin: boolean;
  /** Admin personal pref: show vendor source under the title. */
  showSourceLabels?: boolean;
  /** Pre-fills the symbol filter, e.g. arriving via `?symbol=` from Analytics. */
  initialSymbolFilter?: string;
  /** Full filter combo from a saved watchlist's "Apply to feed" deep link. */
  initialWatchlistCriteria?: WatchlistCriteria;
  /** Re-opens the split panel, e.g. arriving via `?c=` after details. */
  initialSelectedId?: number;
  /**
   * Fired with the resolved symbol whenever the split panel opens on a row
   * that has one — keeps the dashboard Watchlist rail highlight in sync with
   * whichever tape row you're triaging. Optional; no-op when omitted.
   */
  onFocusSymbol?: (symbol: string) => void;
  /**
   * True while the triage split is open. Desk shell uses this to transiently
   * hide the calendar/watchlist rail so split (+ chart) can use the right side.
   */
  onSplitOpenChange?: (open: boolean) => void;
  /**
   * When the desk Economic Calendar rail is collapsed, show a header control
   * so it can be restored without hunting for the slim edge strip.
   */
  calendarRailHidden?: boolean;
  onShowCalendarRail?: () => void;
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
  const [chartRange, setChartRange] =
    useState<ChartRangeKey>(DEFAULT_CHART_RANGE);
  const isXlDesk = useIsXlDesk();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [filterRecalc, setFilterRecalc] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(() =>
    readDismissedIds(),
  );
  const [dismissingIds, setDismissingIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);
  const [signalWatchlists, setSignalWatchlists] = useState<
    QuietSignalWatchlist[]
  >([]);
  const [quietMode, setQuietMode] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [articleId, setArticleId] = useState<number | null>(null);
  const [pendingNew, setPendingNew] = useState(0);
  const [saveWatchlistOpen, setSaveWatchlistOpen] = useState(false);
  const [saveWatchlistName, setSaveWatchlistName] = useState("");
  const [savingWatchlist, setSavingWatchlist] = useState(false);
  const [savedWatchlists, setSavedWatchlists] = useState<
    { id: number; name: string; criteria: WatchlistCriteria }[]
  >([]);
  const [appliedWatchlist, setAppliedWatchlist] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [watchlistEditorOpen, setWatchlistEditorOpen] = useState(false);
  const [watchlistEditorDraft, setWatchlistEditorDraft] =
    useState<WatchlistDraft | null>(null);
  const jumpToLatestRef = useRef<(() => void) | null>(null);
  const skipFilterAnimRef = useRef(true);
  const skipFlashRef = useRef(false);
  const knownIds = useRef(new Set(initialCatalysts.map((c) => c.id)));
  const pollErrorRef = useRef<string | null>(null);

  const reloadWatchlistSymbols = useCallback(async () => {
    try {
      const wRes = await fetch("/api/watchlist", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!wRes.ok) return;
      const wData = await wRes.json();
      const symbols = (wData.symbols ?? []).map(
        (t: { symbol: string }) => t.symbol,
      );
      setWatchlistSymbols(symbols);
    } catch {
      // Soft-fail: quiet playbook / Watch actions still usable.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadPrefs() {
      try {
        const [wRes, pRes, listsRes] = await Promise.all([
          fetch("/api/watchlist", {
            credentials: "same-origin",
            cache: "no-store",
          }),
          fetch("/api/playbook", {
            credentials: "same-origin",
            cache: "no-store",
          }),
          fetch("/api/watchlists", {
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
          setSignalWatchlists(
            Array.isArray(pData.signalWatchlists) ? pData.signalWatchlists : [],
          );
          setQuietMode(Boolean(pData.quietMode));
        }
        if (listsRes.ok) {
          const listsData = await listsRes.json();
          const list = Array.isArray(listsData.watchlists)
            ? listsData.watchlists
            : [];
          setSavedWatchlists(
            list.map(
              (w: {
                id: number;
                name: string;
                criteria?: WatchlistCriteria;
              }) => ({
                id: w.id,
                name: w.name,
                criteria: w.criteria ?? {},
              }),
            ),
          );
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

  useEffect(
    () => subscribeWatchlistChanged(() => void reloadWatchlistSymbols()),
    [reloadWatchlistSymbols],
  );

  // Restore tape filters from localStorage after mount (avoids SSR/hydration
  // mismatch). Deep-link `?symbol=` wins as an exact symbol chip; other
  // saved filters still apply when still within the idle window.
  useEffect(() => {
    const restoreId = window.setTimeout(() => {
      const saved = readPersistedFeedFilters();
      const urlSymbol = initialSymbolFilter?.trim().toUpperCase() ?? "";
      // Drop retired panel facets (industries / forms / earnings surprises)
      // and never restore vendor source filters outside local-dev.
      const sanitize = (filters: FeedFilterState): FeedFilterState => ({
        ...filters,
        sectorFilters: [],
        formFilters: [],
        earningsSurprisesOnly: false,
        sourceFilters: isLocalDevUi() ? filters.sourceFilters : [],
      });

      if (initialWatchlistCriteria) {
        setFilterState((prev) => ({
          ...DEFAULT_FEED_FILTERS,
          ...prev,
          ...watchlistCriteriaToFilters(initialWatchlistCriteria),
          symbolOnly: true,
        }));
        setFiltersOpen(true);
        setFiltersHydrated(true);
        return;
      }

      if (urlSymbol) {
        setFilterState((prev) => ({
          ...prev,
          ...(saved
            ? sanitize({
                ...prev,
                categoryFilters: saved.categoryFilters,
                sourceFilters: saved.sourceFilters,
                tagFilters: saved.tagFilters,
                timeWindow: saved.timeWindow,
                symbolOnly: saved.symbolOnly,
              })
            : {}),
          symbolFilters: [urlSymbol],
          // Desk rule is always on (CPI / Jobs excepted).
          symbolOnly: true,
        }));
      } else if (saved) {
        const restored = { ...sanitize(saved), symbolOnly: true };
        setFilterState(restored);
      }
      setFiltersHydrated(true);
    }, 0);
    return () => window.clearTimeout(restoreId);
  }, [initialSymbolFilter, initialWatchlistCriteria, setFilterState]);

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
      // Signal sources (watchlistIds) are unaffected — the API preserves
      // whatever was last saved when the field is omitted.
      await fetch("/api/playbook", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quietMode: next }),
      });
    } catch {
      setQuietMode(!next);
    }
  }, [quietMode]);

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
      const t = symbol.trim().toUpperCase();
      if (!t) return;
      // Exact chip, not the fuzzy `q` search — "Filter tape to SYMBOL"
      // should gate rows to that name only, not just bias the search box.
      setFilterState((prev) => ({
        ...prev,
        symbolFilters: prev.symbolFilters.includes(t)
          ? prev.symbolFilters
          : [...prev.symbolFilters, t],
      }));
      setFiltersOpen(true);
    },
    [setFilterState],
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
        notifyWatchlistChanged();
        return true;
      } catch {
        setWatchlistSymbols((prev) => prev.filter((x) => x !== t));
        return false;
      }
    },
    [watchlistSymbols],
  );

  const removeFlatWatchlistSymbol = useCallback(
    async (symbol: string): Promise<boolean> => {
      const t = symbol.trim().toUpperCase();
      if (!t) return false;
      setWatchlistSymbols((prev) => prev.filter((x) => x !== t));
      try {
        const res = await fetch(
          `/api/watchlist?symbol=${encodeURIComponent(t)}`,
          { method: "DELETE", credentials: "same-origin" },
        );
        if (!res.ok) throw new Error("delete failed");
        notifyWatchlistChanged();
        return true;
      } catch {
        setWatchlistSymbols((prev) =>
          prev.includes(t) ? prev : [...prev, t].sort(),
        );
        return false;
      }
    },
    [],
  );

  /** "My symbols" is one of several watchlist destinations now — see the
   * per-row "Watchlists" checklist (`AddToWatchlistSubmenu` /
   * `AddToWatchlistButton`) for the multi-watchlist picker this feeds. */
  const toggleFlatWatchlist = useCallback(
    async (symbol: string | null) => {
      const t = symbol?.trim().toUpperCase();
      if (!t) return;
      if (watchlistSymbols.includes(t)) {
        const ok = await removeFlatWatchlistSymbol(t);
        if (ok) toast.success(`${t} removed from My symbols`);
        else toast.error(`Could not remove ${t} from My symbols`);
        return;
      }
      const ok = await quietAddSymbol(t);
      if (ok) toast.success(`${t} added to My symbols`);
      else toast.error(`Could not add ${t} to My symbols`);
    },
    [quietAddSymbol, removeFlatWatchlistSymbol, watchlistSymbols],
  );

  const toggleSavedWatchlistSymbol = useCallback(
    async (destination: WatchlistDestination, symbol: string | null) => {
      const t = symbol?.trim().toUpperCase();
      if (!t) return;
      const watchlist = savedWatchlists.find((w) => w.id === destination.id);
      if (!watchlist) return;
      const add = !destination.checked;
      const current = watchlist.criteria.symbols ?? [];
      const nextSymbols = add
        ? current.includes(t)
          ? current
          : [...current, t]
        : current.filter((s) => s !== t);

      const nextCriteria: WatchlistCriteria = { ...watchlist.criteria };
      if (nextSymbols.length > 0) nextCriteria.symbols = nextSymbols;
      else delete nextCriteria.symbols;

      if (Object.keys(nextCriteria).length === 0) {
        toast.error(
          `Removing ${t} would leave "${watchlist.name}" with no filters — edit or delete it on the Watchlists page instead.`,
        );
        return;
      }

      setSavedWatchlists((prev) =>
        prev.map((w) =>
          w.id === watchlist.id ? { ...w, criteria: nextCriteria } : w,
        ),
      );
      try {
        const res = await fetch(`/api/watchlists/${watchlist.id}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ criteria: nextCriteria }),
        });
        if (!res.ok) throw new Error("patch failed");
        notifyWatchlistChanged();
        toast.success(
          add
            ? `${t} added to "${watchlist.name}"`
            : `${t} removed from "${watchlist.name}"`,
        );
      } catch {
        setSavedWatchlists((prev) =>
          prev.map((w) => (w.id === watchlist.id ? watchlist : w)),
        );
        toast.error(`Could not update "${watchlist.name}"`);
      }
    },
    [savedWatchlists],
  );

  const destinationsForSymbol = useCallback(
    (symbol: string | null): WatchlistDestination[] => {
      const t = symbol?.trim().toUpperCase() ?? "";
      if (!t) return [];
      return savedWatchlists.map((w) => ({
        id: w.id,
        name: w.name,
        checked: (w.criteria.symbols ?? []).includes(t),
      }));
    },
    [savedWatchlists],
  );

  const openCreateWatchlistForSymbol = useCallback((symbol: string | null) => {
    const t = symbol?.trim().toUpperCase();
    setWatchlistEditorDraft({
      id: null,
      name: "",
      criteria: t ? { symbols: [t] } : {},
    });
    setWatchlistEditorOpen(true);
  }, []);

  const openSaveWatchlist = useCallback(() => {
    setSaveWatchlistName("");
    setSaveWatchlistOpen(true);
  }, []);

  const applySavedWatchlist = useCallback(
    (watchlist: { id: number; name: string; criteria: WatchlistCriteria }) => {
      setFilterState((prev) => ({
        ...DEFAULT_FEED_FILTERS,
        ...watchlistCriteriaToFilters(watchlist.criteria),
        timeWindow: prev.timeWindow,
        symbolOnly: true,
      }));
      setAppliedWatchlist({ id: watchlist.id, name: watchlist.name });
      setFiltersOpen(true);
      toast.success(`Applied "${watchlist.name}" filters`);
    },
    [setFilterState],
  );

  const handlePatchFilters = useCallback(
    (patch: Partial<FeedFilterState>) => {
      setAppliedWatchlist(null);
      patchFilters(patch);
    },
    [patchFilters],
  );

  const handleClearFilters = useCallback(() => {
    setAppliedWatchlist(null);
    clearFilters();
  }, [clearFilters]);

  const reloadSavedWatchlists = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlists", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data.watchlists) ? data.watchlists : [];
      setSavedWatchlists(
        list.map(
          (w: { id: number; name: string; criteria?: WatchlistCriteria }) => ({
            id: w.id,
            name: w.name,
            criteria: w.criteria ?? {},
          }),
        ),
      );
    } catch {
      // Soft-fail.
    }
  }, []);

  useEffect(
    () => subscribeWatchlistChanged(() => void reloadSavedWatchlists()),
    [reloadSavedWatchlists],
  );

  const submitSaveWatchlist = useCallback(async () => {
    const name = saveWatchlistName.trim();
    if (!name) {
      toast.error("Name your watchlist first.");
      return;
    }
    setSavingWatchlist(true);
    try {
      const res = await fetch("/api/watchlists", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          criteria: filtersToWatchlistCriteria(filterState),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save watchlist.");
      toast.success(`Saved "${name}" — manage it under Watchlists.`);
      setSaveWatchlistOpen(false);
      await reloadSavedWatchlists();
      if (typeof data.id === "number") {
        setAppliedWatchlist({ id: data.id, name });
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save watchlist.",
      );
    } finally {
      setSavingWatchlist(false);
    }
  }, [saveWatchlistName, filterState, reloadSavedWatchlists]);

  const facetOptions = useMemo(() => buildFacetOptions(facets), [facets]);

  const visible = useMemo(() => {
    const filtered = catalysts.filter((c) => {
      if (dismissedIds.has(c.id)) return false;
      return matchesQuietPlaybook(
        {
          symbol: c.symbol,
          eventCategory: c.eventCategory,
          type: c.type,
          tags: c.tags,
          sourceProvider: c.sourceProvider,
          companyName: c.companyName,
          title: c.title,
          headline: c.headline,
        },
        { quietMode, watchlistSymbols, signalWatchlists },
      );
    });
    // Always newest → oldest (event time), even after client overlays.
    return sortFeedNewestFirst(filtered);
  }, [catalysts, dismissedIds, quietMode, watchlistSymbols, signalWatchlists]);

  const selectedRaw = selectedId
    ? (catalysts.find((c) => c.id === selectedId) ?? null)
    : null;
  // Desk rule: don't open the split panel for unresolved names
  // (CPI / Jobs NFP macro exceptions may still open without a symbol).
  const selected =
    selectedRaw && passesSymbolFeedGate(selectedRaw) ? selectedRaw : null;

  // Keep the dashboard Watchlist rail highlight in sync with the open row —
  // additive, no-op without `onFocusSymbol`.
  useEffect(() => {
    if (selected?.symbol) onFocusSymbol?.(selected.symbol);
  }, [selected, onFocusSymbol]);

  const selectedSymbol = selected?.symbol?.trim().toUpperCase() || null;
  const splitOpen = Boolean(selected);

  useEffect(() => {
    onSplitOpenChange?.(splitOpen);
    return () => onSplitOpenChange?.(false);
  }, [splitOpen, onSplitOpenChange]);

  // Reset shared chart lookback when the open symbol changes.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setChartRange(DEFAULT_CHART_RANGE);
    }, 0);
    return () => window.clearTimeout(id);
  }, [selectedSymbol]);

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

  return (
    <section
      className="news-panel desk-arial flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]"
      aria-label="Catalyst Feed"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--desk-border)] bg-[var(--desk-header)] px-4 py-3.5 sm:px-5">
        <h1 className="desk-heading text-[var(--desk-text)]">Catalyst Feed</h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {calendarRailHidden && onShowCalendarRail ? (
            <button
              type="button"
              onClick={onShowCalendarRail}
              title="Show economic calendar"
              aria-label="Show economic calendar"
              className="btn-press hidden items-center gap-1.5 rounded-lg border border-[var(--desk-live)]/45 bg-[var(--desk-live)]/10 px-2.5 py-1.5 text-[0.82rem] font-medium text-[var(--desk-live)] transition-colors hover:bg-[var(--desk-live)]/15 xl:inline-flex"
            >
              <CalendarDays className="size-3.5" />
              Economic calendar
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void toggleQuietMode()}
            disabled={!prefsLoaded}
            title="When on, only show catalysts matching your symbols or selected signal watchlists (edit under Watchlists)"
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
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2.5 py-1.5 text-[0.82rem] font-medium text-[var(--desk-text-secondary)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
            >
              <X className="size-3.5 text-[var(--desk-text-muted)]" />
              Clear filters
            </button>
          ) : null}
          {pendingNew > 0 ? (
            <button
              type="button"
              onClick={() => jumpToLatestRef.current?.()}
              aria-label={`Jump to ${pendingNew} new catalysts`}
              title="Jump to newest catalysts"
              className="btn-press inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--desk-live-status)_50%,transparent)] bg-[var(--desk-live-status)] px-2.5 font-mono text-[0.72rem] font-semibold tracking-wide text-[var(--desk-accent-fg)] uppercase transition-opacity hover:opacity-90"
            >
              <ArrowUp className="size-3.5" aria-hidden />
              {pendingNew} new
            </button>
          ) : null}
        </div>
      </div>

      {filtersOpen ? (
        <div className="border-b border-[var(--desk-border)] bg-[var(--desk-header)]/80 px-4 py-3 sm:px-5">
          <FeedFilters
            filterState={filterState}
            onPatchFilters={handlePatchFilters}
            facetOptions={facetOptions}
            total={total}
            visibleCount={visible.length}
            quietMode={quietMode}
            watchlistCount={watchlistSymbols.length}
            signalWatchlistCount={signalWatchlists.length}
            panelFiltersActive={panelFiltersActive}
            onClearFilters={handleClearFilters}
            onSaveWatchlist={openSaveWatchlist}
            savedWatchlists={savedWatchlists}
            appliedWatchlist={appliedWatchlist}
            onApplyWatchlist={applySavedWatchlist}
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
        <div
          className={cn(
            "flex min-h-0 min-w-[220px] flex-1 flex-col",
            // Split-open desk: slim the tape so triage (+ chart) own the right.
            splitOpen && "xl:max-w-[300px] xl:flex-none",
          )}
        >
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
                    The tape lists events by when they happened. Older filings
                    can still appear after a refresh. Widen the window or show
                    All.
                  </p>
                </>
              ) : (
                <p className="text-sm text-[var(--desk-text-muted)]">
                  {emptyKind === "quiet"
                    ? "Quiet mode: no rows match your symbols or selected watchlists right now."
                    : "No rows match these filters."}
                </p>
              )}
              {emptyKind === "time_window" || emptyKind === "filters" ? (
                <button
                  type="button"
                  onClick={() => {
                    handleClearFilters();
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
              splitOpen={Boolean(selected)}
              showSourceLabels={showSourceLabels}
              watchlistSymbols={watchlistSymbols}
              destinationsForSymbol={destinationsForSymbol}
              onSelect={openSplit}
              onRead={openArticle}
              onPrefetch={prefetchQuote}
              onAct={openSplit}
              onDismiss={dismissCatalyst}
              onToggleFlatWatchlist={toggleFlatWatchlist}
              onToggleSavedWatchlist={toggleSavedWatchlistSymbol}
              onCreateWatchlist={openCreateWatchlistForSymbol}
              onFilterToSymbol={filterToSymbol}
              restoreScrollToSelected={Boolean(initialSelectedId)}
              hasMore={Boolean(nextCursor)}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
              onPendingNewChange={setPendingNew}
              jumpToLatestRef={jumpToLatestRef}
            />
          )}
        </div>

        {selected ? (
          <>
            <button
              type="button"
              aria-label="Close panel backdrop"
              className="fixed inset-0 z-40 bg-[var(--desk-scrim)] xl:hidden"
              onClick={() => setSelectedId(null)}
            />
            <div
              className={cn(
                // Mobile overlay must be opaque so feed text doesn't show through.
                // Desktop dock keeps the glass desk panel token.
                "z-50 flex min-h-0 bg-popover xl:bg-[var(--desk-panel)]",
                "fixed inset-0 flex-col",
                // Desktop: dock grows so the chart pane can be the hero width.
                "xl:static xl:inset-auto xl:z-auto xl:min-w-0 xl:flex-1 xl:flex-row",
              )}
            >
              <TapeSplitPanel
                key={selected.id}
                catalyst={selected}
                isAdmin={isAdmin}
                showSourceLabels={showSourceLabels}
                chartRange={chartRange}
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
                chartSlot={
                  selectedSymbol && !isXlDesk ? (
                    <TapeChartPanel
                      symbol={selectedSymbol}
                      range={chartRange}
                      onRangeChange={setChartRange}
                      eventTimeSec={
                        selected.timestamp
                          ? Math.floor(
                              new Date(selected.timestamp).getTime() / 1000,
                            )
                          : null
                      }
                      density="compact"
                      className="shrink-0 border-b border-[var(--desk-border)]"
                      chartClassName="h-[220px] max-h-[32vh] border-t-0 sm:h-[260px] sm:max-h-[34vh]"
                    />
                  ) : null
                }
                className={cn(
                  "min-h-0 min-w-0 flex-1 border-0",
                  // Desktop dock: split and chart share the right side 50/50.
                  "xl:min-w-0 xl:flex-1 xl:border-l",
                )}
              />
              {selectedSymbol && isXlDesk ? (
                <TapeChartPanel
                  symbol={selectedSymbol}
                  range={chartRange}
                  onRangeChange={setChartRange}
                  eventTimeSec={
                    selected.timestamp
                      ? Math.floor(
                          new Date(selected.timestamp).getTime() / 1000,
                        )
                      : null
                  }
                  density="compact"
                  className="min-h-0 min-w-0 flex-1 border-l"
                  chartClassName="h-full min-h-0 border-t-0"
                />
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      <CatalystArticleDialog
        catalystId={articleId}
        isAdmin={isAdmin}
        showSourceLabels={showSourceLabels}
        open={articleId != null}
        onOpenChange={(next) => {
          if (!next) setArticleId(null);
        }}
      />

      <Dialog open={saveWatchlistOpen} onOpenChange={setSaveWatchlistOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as watchlist</DialogTitle>
            <DialogDescription>
              Freezes your current symbol / event-type / tag / source filters
              into a named list you can preview, re-apply, and manage under
              Watchlists.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={saveWatchlistName}
            onChange={(e) => setSaveWatchlistName(e.target.value)}
            placeholder="e.g. AH biotech catalysts"
            aria-label="Watchlist name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitSaveWatchlist();
            }}
          />
          <DialogFooter className="sm:justify-between">
            <Link
              href="/watchlist"
              onClick={() => {
                writeWatchlistDraftHandoff({
                  name: saveWatchlistName.trim() || undefined,
                  criteria: filtersToWatchlistCriteria(filterState),
                });
                setSaveWatchlistOpen(false);
              }}
              className="inline-flex items-center gap-1.5 self-center font-mono text-[0.72rem] text-[var(--desk-text-muted)] underline-offset-2 hover:text-[var(--desk-text)] hover:underline"
            >
              Need dynamic rules or AI help? Open the builder →
            </Link>
            <Button
              type="button"
              disabled={savingWatchlist}
              onClick={() => void submitSaveWatchlist()}
              className="bg-[var(--desk-live)] text-[var(--desk-accent-fg)] hover:brightness-110"
            >
              {savingWatchlist ? "Saving…" : "Save watchlist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WatchlistEditorDialog
        open={watchlistEditorOpen}
        draft={watchlistEditorDraft}
        onOpenChange={setWatchlistEditorOpen}
        onSaved={() => {
          notifyWatchlistChanged();
        }}
      />
    </section>
  );
}

interface FacetOptions {
  categories: { value: string; label: string; count?: number }[];
  sources: { value: string; label: string; count?: number }[];
  tags: { value: string; label: string; count?: number }[];
}

/** `category:earnings` → "Category: earnings" for the tag multi-select. */
function tagLabel(tag: string): string {
  const [ns, ...rest] = tag.split(":");
  if (rest.length === 0) return tag;
  const value = rest.join(":");
  return `${ns.charAt(0).toUpperCase()}${ns.slice(1)}: ${value}`;
}

function buildFacetOptions(facets: FeedFacets | null): FacetOptions {
  return {
    categories: (facets?.categories ?? []).map((b) => ({
      value: b.key,
      label: CATEGORY_LABELS[b.key as EventCategoryKey] ?? b.key,
      count: b.count,
    })),
    sources: (facets?.sources ?? []).map((b) => ({
      value: b.key,
      label: b.key,
      count: b.count,
    })),
    tags: (facets?.tags ?? []).map((b) => ({
      value: b.key,
      label: tagLabel(b.key),
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
  signalWatchlistCount: number;
  panelFiltersActive: boolean;
  onClearFilters: () => void;
  onSaveWatchlist: () => void;
  savedWatchlists: { id: number; name: string; criteria: WatchlistCriteria }[];
  appliedWatchlist: { id: number; name: string } | null;
  onApplyWatchlist: (watchlist: {
    id: number;
    name: string;
    criteria: WatchlistCriteria;
  }) => void;
}

function FeedFilters({
  filterState,
  onPatchFilters,
  facetOptions,
  total,
  visibleCount,
  quietMode,
  watchlistCount,
  signalWatchlistCount,
  panelFiltersActive,
  onClearFilters,
  onSaveWatchlist,
  savedWatchlists,
  appliedWatchlist,
  onApplyWatchlist,
}: FeedFiltersProps) {
  const removeSymbolFilter = (symbol: string) =>
    onPatchFilters({
      symbolFilters: filterState.symbolFilters.filter((s) => s !== symbol),
    });

  return (
    <div className="flex flex-col gap-2">
      {quietMode ? (
        <p className="font-mono text-[0.72rem] text-[var(--desk-text-dim)]">
          Quiet mode on · {watchlistCount} symbol
          {watchlistCount === 1 ? "" : "s"} · {signalWatchlistCount} watchlist
          {signalWatchlistCount === 1 ? "" : "s"} selected — edit under
          Watchlists.
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          value={filterState.symbolQuery}
          onChange={(e) => onPatchFilters({ symbolQuery: e.target.value })}
          placeholder="Search symbol, company, title…"
          aria-label="Search by symbol, company, or title"
          className="h-8 w-full border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-xs tracking-wide sm:w-56 md:text-xs"
        />
        <div
          className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-md border border-[var(--desk-border)] bg-[var(--desk-overlay-soft)] p-0.5"
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
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[0.72rem] tracking-wide transition-colors",
                appliedWatchlist
                  ? "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-strong)] text-[var(--desk-text)]"
                  : "border-[var(--desk-border)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-muted)] hover:border-[var(--desk-border-strong)] hover:text-[var(--desk-text)]",
              )}
            >
              <span className="max-w-[11rem] truncate">
                {appliedWatchlist ? appliedWatchlist.name : "Watchlists"}
              </span>
              <ChevronDown className="size-3 shrink-0 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[14rem]">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-mono text-[0.65rem] tracking-wide uppercase">
                  Apply saved watchlist
                </DropdownMenuLabel>
                {savedWatchlists.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-[var(--desk-text-muted)]">
                    No watchlists yet — create one first.
                  </p>
                ) : (
                  savedWatchlists.map((w) => (
                    <DropdownMenuItem
                      key={w.id}
                      onClick={() => onApplyWatchlist(w)}
                      className="font-mono text-xs"
                    >
                      {w.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link
            href="/watchlist"
            title="Create or manage watchlists"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--desk-border)] bg-[var(--desk-overlay-soft)] px-2.5 font-mono text-[0.7rem] tracking-wide text-[var(--desk-text-muted)] transition-colors hover:border-[var(--desk-border-strong)] hover:text-[var(--desk-text)]"
          >
            <Plus className="size-3" />
            Create
          </Link>
          <FeedFilterMultiSelect
            label="Event type"
            options={facetOptions.categories}
            selected={filterState.categoryFilters}
            onChange={(categoryFilters) =>
              onPatchFilters({
                categoryFilters: categoryFilters as EventCategoryKey[],
              })
            }
            emptyLabel="All event types"
            searchPlaceholder="Search event types…"
          />
          <FeedFilterMultiSelect
            label="Tag"
            options={facetOptions.tags}
            selected={filterState.tagFilters}
            onChange={(tagFilters) => onPatchFilters({ tagFilters })}
            emptyLabel="All tags"
            searchPlaceholder="Search tags…"
          />
          {isLocalDevUi() ? (
            <FeedFilterMultiSelect
              label="Source"
              options={facetOptions.sources}
              selected={filterState.sourceFilters}
              onChange={(sourceFilters) => onPatchFilters({ sourceFilters })}
              emptyLabel="All sources"
            />
          ) : null}
          {panelFiltersActive ? (
            <button
              type="button"
              onClick={onSaveWatchlist}
              title="Save these filters as a named, re-appliable watchlist"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2.5 font-mono text-[0.7rem] tracking-wide text-[var(--desk-text-secondary)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
            >
              <Plus className="size-3" />
              Save as watchlist
            </button>
          ) : null}
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
      </div>
      {appliedWatchlist ||
      filterState.symbolFilters.length > 0 ||
      filterState.tagFilters.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Active exact filters"
        >
          {appliedWatchlist ? (
            <ActiveFilterChip
              label={`Watchlist: ${appliedWatchlist.name}`}
              onRemove={onClearFilters}
            />
          ) : null}
          {filterState.symbolFilters.map((symbol) => (
            <ActiveFilterChip
              key={`symbol:${symbol}`}
              label={symbol}
              onRemove={() => removeSymbolFilter(symbol)}
            />
          ))}
          {filterState.tagFilters.map((tag) => (
            <ActiveFilterChip
              key={`tag:${tag}`}
              label={tagLabel(tag)}
              onRemove={() =>
                onPatchFilters({
                  tagFilters: filterState.tagFilters.filter((t) => t !== tag),
                })
              }
            />
          ))}
        </div>
      ) : null}
      {total != null ? (
        <p className="font-mono text-[0.72rem] text-[var(--desk-text-dim)] tabular-nums">
          Showing {visibleCount} of {total}
        </p>
      ) : null}
    </div>
  );
}

function ActiveFilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--desk-live)]/40 bg-[var(--desk-live)]/10 px-2 py-0.5 font-mono text-[0.68rem] tracking-wide text-[var(--desk-live)]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="rounded-full p-0.5 hover:bg-[var(--desk-live)]/20"
      >
        <X className="size-2.5" />
      </button>
    </span>
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
        "inline-flex h-7 items-center rounded-[5px] px-2.5 font-mono text-[0.7rem] tracking-wide transition-colors",
        active
          ? "bg-[var(--desk-panel)] text-[var(--desk-text)] shadow-[inset_0_0_0_1px_var(--desk-border-strong)]"
          : "bg-transparent text-[var(--desk-text-muted)] hover:text-[var(--desk-text)]",
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
  splitOpen = false,
  showSourceLabels = false,
  watchlistSymbols,
  destinationsForSymbol,
  onSelect,
  onRead,
  onPrefetch,
  onAct,
  onDismiss,
  onToggleFlatWatchlist,
  onToggleSavedWatchlist,
  onCreateWatchlist,
  onFilterToSymbol,
  restoreScrollToSelected = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onPendingNewChange,
  jumpToLatestRef,
}: {
  catalysts: FeedCatalyst[];
  flashIds: Set<number>;
  dismissingIds: Set<number>;
  selectedId: number | null;
  /** When the split panel is open, drop the Actions column so titles stay readable. */
  splitOpen?: boolean;
  showSourceLabels?: boolean;
  watchlistSymbols: string[];
  /** Saved (rule-based) watchlists this symbol already belongs to. */
  destinationsForSymbol: (symbol: string | null) => WatchlistDestination[];
  onSelect: (id: number) => void;
  onRead: (id: number) => void;
  onPrefetch: (id: number) => void;
  onAct: (id: number) => void;
  onDismiss: (id: number) => void;
  onToggleFlatWatchlist: (symbol: string | null) => void;
  onToggleSavedWatchlist: (
    destination: WatchlistDestination,
    symbol: string | null,
  ) => void;
  onCreateWatchlist: (symbol: string | null) => void;
  onFilterToSymbol: (symbol: string) => void;
  /** One-shot scroll to the open row after returning from article. */
  restoreScrollToSelected?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  /** Report how many new rows arrived while the user was scrolled down. */
  onPendingNewChange?: (count: number) => void;
  /** Parent toolbar registers jump-to-latest via this ref. */
  jumpToLatestRef?: MutableRefObject<(() => void) | null>;
}) {
  const feedGrid = splitOpen ? FEED_GRID_SPLIT : FEED_GRID;
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

  // "N new" affordance: when the user has scrolled down, newly-arrived rows
  // land at the top of the tape (out of view). Count them here and report to
  // the parent toolbar — click scrolls back to newest.
  const [atTop, setAtTop] = useState(true);
  const [pendingNew, setPendingNew] = useState(0);
  const knownListIds = useRef<Set<number>>(new Set(catalysts.map((c) => c.id)));

  useEffect(() => {
    onPendingNewChange?.(pendingNew);
  }, [pendingNew, onPendingNewChange]);

  useEffect(() => {
    return () => onPendingNewChange?.(0);
  }, [onPendingNewChange]);

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
    if (!jumpToLatestRef) return;
    jumpToLatestRef.current = scrollToTop;
    return () => {
      jumpToLatestRef.current = null;
    };
  }, [jumpToLatestRef, scrollToTop]);

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
          "feed-sticky-cols desk-caps sticky top-0 z-10 grid h-10 items-center gap-2 border-b border-[var(--desk-border)] px-4 font-mono text-[0.62rem] font-medium text-[var(--desk-text-muted)] uppercase sm:gap-3 sm:px-5 lg:gap-4",
          feedGrid,
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
          className={cn(
            "hidden min-w-0",
            // Split mode drops Time until xl so titles keep a readable track.
            splitOpen ? "xl:block" : "sm:block",
          )}
          title="When the event occurred (your local time) — not when we fetched it"
        >
          Time
        </div>
        {!splitOpen ? (
          <div
            role="columnheader"
            className="hidden justify-self-end pl-1 text-right lg:block"
          >
            Actions
          </div>
        ) : null}
      </div>

      <div className="flex flex-col">
        {catalysts.map((catalyst, index) => {
          const flashing = flashIds.has(catalyst.id);
          const dismissing = dismissingIds.has(catalyst.id);
          const selected = selectedId === catalyst.id;
          const eventLabel = feedEventLabel(catalyst);
          const title = titleLine(catalyst);
          const tooltipTitle = titleTooltipLine(catalyst);
          const sourceName = showSourceLabels
            ? sourceDisplay(catalyst).name
            : null;
          const watchlistFlatChecked = Boolean(
            catalyst.symbol &&
            watchlistSymbols.includes(catalyst.symbol.toUpperCase()),
          );
          const watchlistDestinations = destinationsForSymbol(catalyst.symbol);
          const onWatchlist =
            watchlistFlatChecked ||
            watchlistDestinations.some((d) => d.checked);
          const renderSymbol = () =>
            catalyst.symbol ? (
              <SymbolActionMenu
                symbol={catalyst.symbol}
                companyName={catalyst.companyName}
                catalystId={catalyst.id}
                watchlistFlatChecked={watchlistFlatChecked}
                watchlistDestinations={watchlistDestinations}
                onFilterToSymbol={() => onFilterToSymbol(catalyst.symbol!)}
                onOpenPanel={() => onAct(catalyst.id)}
                onOpenArticle={() => onRead(catalyst.id)}
                onToggleFlatWatchlist={() =>
                  onToggleFlatWatchlist(catalyst.symbol)
                }
                onToggleSavedWatchlist={(destination) =>
                  onToggleSavedWatchlist(destination, catalyst.symbol)
                }
                onCreateWatchlist={() => onCreateWatchlist(catalyst.symbol)}
                onDismiss={() => onDismiss(catalyst.id)}
              />
            ) : (
              <span className="desk-data truncate font-semibold tracking-tight text-[var(--desk-text-dim)]">
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
                "feed-row group relative grid min-h-[56px] cursor-pointer items-center gap-2 border-b border-[var(--desk-border)] px-4 py-3 transition-colors duration-150 outline-none sm:min-h-[64px] sm:gap-3 sm:px-5 sm:py-1.5 lg:gap-4",
                feedGrid,
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
                  sourceName={sourceName}
                />
                {/* Mobile: Time under Title (Symbol is the leading index col) */}
                <div className="mt-1.5 flex flex-col gap-1 sm:hidden">
                  <time
                    dateTime={catalyst.timestamp}
                    className="desk-data font-medium tracking-tight whitespace-nowrap text-[var(--desk-text-muted)]"
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
                    <WatchAction
                      symbol={catalyst.symbol}
                      onWatchlist={onWatchlist}
                      flatChecked={watchlistFlatChecked}
                      destinations={watchlistDestinations}
                      onToggleFlat={() =>
                        onToggleFlatWatchlist(catalyst.symbol)
                      }
                      onToggleSaved={(destination) =>
                        onToggleSavedWatchlist(destination, catalyst.symbol)
                      }
                      onCreateNew={() => onCreateWatchlist(catalyst.symbol)}
                    />
                  ) : null}
                </div>
              </div>

              <div
                role="cell"
                className={cn(
                  "relative z-[2] hidden min-w-0 overflow-hidden pr-1",
                  splitOpen ? "xl:block" : "sm:block",
                )}
              >
                <FeedTimeStamp iso={catalyst.timestamp} />
              </div>

              {/* Desktop: actions appear on row hover / focus / selection.
                  Hidden while split is open — that column was starving titles. */}
              {!splitOpen ? (
                <div
                  role="cell"
                  className="relative z-0 hidden min-w-0 pl-2 lg:block"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {/* Details stays shrink-0 on the left of the cluster; if the
                      track is tight, Dismiss/Watch clip first — never “ETAILS”. */}
                  <div
                    className={cn(
                      "ml-auto flex max-w-full flex-nowrap items-center justify-end gap-1 transition-opacity duration-100",
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
                    <div className="flex min-w-0 flex-nowrap items-center justify-end gap-1 overflow-hidden">
                      <FeedActionButton
                        onClick={() => onDismiss(catalyst.id)}
                        tip="Hide from results"
                      >
                        <X className="size-3" />
                        Dismiss
                      </FeedActionButton>
                      {catalyst.symbol ? (
                        <WatchAction
                          symbol={catalyst.symbol}
                          onWatchlist={onWatchlist}
                          flatChecked={watchlistFlatChecked}
                          destinations={watchlistDestinations}
                          onToggleFlat={() =>
                            onToggleFlatWatchlist(catalyst.symbol)
                          }
                          onToggleSaved={(destination) =>
                            onToggleSavedWatchlist(destination, catalyst.symbol)
                          }
                          onCreateNew={() => onCreateWatchlist(catalyst.symbol)}
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
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

/** Two-line local event stamp — clock, then calendar day (zone on title). */
function FeedTimeStamp({ iso }: { iso: string }) {
  const parts = formatEventTimeParts(iso);
  if (!parts) {
    return (
      <time
        dateTime={iso}
        className="desk-data font-medium tracking-tight text-[var(--desk-text-muted)]"
      >
        —
      </time>
    );
  }
  return (
    <time
      dateTime={iso}
      className="desk-data block min-w-0 font-medium tracking-tight text-[var(--desk-text-muted)]"
      title={formatTimeDate(iso)}
    >
      <span className="block truncate whitespace-nowrap">{parts.clock}</span>
      <span className="mt-0.5 block truncate text-[0.92em] whitespace-nowrap text-[var(--desk-text-dim)]">
        {parts.day}
      </span>
    </time>
  );
}

function FeedTitleWithTooltip({
  title,
  tooltipTitle,
  companyName,
  eventLabel,
  symbol,
  sourceName = null,
}: {
  title: string;
  /** Longer filing blurb for hover (not the truncated tape line). */
  tooltipTitle: string;
  companyName: string | null;
  eventLabel: string;
  symbol: string | null;
  /** When set (admin “show article source”), muted vendor under the title. */
  sourceName?: string | null;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    maxWidth: number;
  } | null>(null);

  const company = companyName?.trim() || null;
  const normalizedSymbol = symbol?.trim().toUpperCase() || null;
  const source = sourceName?.trim() || null;
  const meta = [normalizedSymbol, company, eventLabel, source]
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
      <span className="feed-article-title block truncate text-[var(--desk-text)]">
        {title}
      </span>
      {source ? (
        <span className="desk-data mt-0.5 block truncate font-medium tracking-tight text-[var(--desk-text-dim)]">
          {source}
        </span>
      ) : null}
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
                "rounded-md border border-[var(--desk-border-strong)] bg-[var(--desk-tooltip)] px-2.5 py-2",
                "shadow-[0_12px_32px_var(--desk-panel-shadow)]",
              )}
            >
              <span className="desk-card-title block leading-snug break-words whitespace-normal text-[var(--desk-text)]">
                {tip}
              </span>
              {meta ? (
                <span className="desk-data mt-1 block leading-snug tracking-wide text-[var(--desk-text-muted)]">
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
          "inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold tracking-wide uppercase transition-[background-color,border-color,color,filter,opacity] duration-100",
          variant === "primary"
            ? "bg-[var(--desk-live)] text-[var(--desk-accent-fg)] hover:brightness-110"
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

/**
 * Quick-action twin of `FeedActionButton`, but a symbol can belong to
 * several watchlists at once now, so this always opens the same "which
 * watchlist(s)?" checklist as `SymbolActionMenu`'s Watchlists submenu
 * (`add-to-watchlist-menu.tsx`) instead of a disable-once-added toggle.
 */
function WatchAction({
  symbol,
  onWatchlist,
  flatChecked,
  destinations,
  onToggleFlat,
  onToggleSaved,
  onCreateNew,
}: {
  symbol: string;
  onWatchlist: boolean;
  flatChecked: boolean;
  destinations: WatchlistDestination[];
  onToggleFlat: () => void;
  onToggleSaved: (destination: WatchlistDestination) => void;
  onCreateNew: () => void;
}) {
  return (
    <DeskTip
      side="top"
      content={
        onWatchlist ? "On your watchlists — tap to manage" : "Add to watchlist"
      }
    >
      <AddToWatchlistButton
        symbol={symbol}
        flatChecked={flatChecked}
        destinations={destinations}
        onToggleFlat={onToggleFlat}
        onToggleSaved={onToggleSaved}
        onCreateNew={onCreateNew}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold tracking-wide uppercase transition-[background-color,border-color,color,filter,opacity] duration-100",
          onWatchlist
            ? "border border-[var(--desk-live)]/50 bg-[var(--desk-live)]/10 text-[var(--desk-live)] hover:bg-[var(--desk-live)]/20"
            : "border border-[var(--desk-border-strong)] text-[var(--desk-text-muted)] hover:border-[var(--desk-text-dim)] hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]",
        )}
      >
        <Plus className="size-3" />
        Watch
      </AddToWatchlistButton>
    </DeskTip>
  );
}
