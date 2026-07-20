"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, ChevronDown, ListFilter, RefreshCw, X } from "lucide-react";

import { CatalystDetailDrawer } from "@/components/catalyst-detail-drawer";
import { EdgarProofLink } from "@/components/edgar-proof-link";
import { MaterialityBadge } from "@/components/materiality-badge";
import { Input } from "@/components/ui/input";
import {
  toFeedCatalyst,
  type FeedCatalyst,
} from "@/lib/catalysts/feed-catalyst";
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
import {
  formatClockTime,
  formatTimeDate,
  isWithinWindow,
} from "@/lib/format/relative-time";
import { cn } from "@/lib/utils";

export type { FeedCatalyst };

const ACTIVE_POLL_MS = 20_000;
const BLURRED_POLL_MS = 90_000;
const DISMISS_STORAGE_KEY = "ci.dismissed-catalyst-ids";

type Presence = "active" | "blurred" | "hidden";
type TimeWindow = "1h" | "4h" | "24h" | "all";

const TIME_WINDOWS: { id: TimeWindow; label: string; hours: number | null }[] =
  [
    { id: "1h", label: "1h", hours: 1 },
    { id: "4h", label: "4h", hours: 4 },
    { id: "24h", label: "24h", hours: 24 },
    { id: "all", label: "All", hours: null },
  ];

/** Blotter: Ticker · Event · Impact · Title · Proof · Time · Action */
const FEED_GRID =
  "grid-cols-1 sm:grid-cols-[72px_88px_78px_minmax(0,1fr)_64px_72px] lg:grid-cols-[80px_96px_84px_minmax(0,1fr)_72px_78px_118px]";

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
}: {
  initialCatalysts: FeedCatalyst[];
  isAdmin: boolean;
}) {
  const [catalysts, setCatalysts] = useState(initialCatalysts);
  const [presence, setPresence] = useState<Presence>("active");
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [flashIds, setFlashIds] = useState<Set<number>>(() => new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tickerQuery, setTickerQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<EventCategoryKey | null>(
    null,
  );
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(() =>
    readDismissedIds(),
  );
  const [watchlistTickers, setWatchlistTickers] = useState<string[]>([]);
  const [playbookCategories, setPlaybookCategories] = useState<
    EventCategoryKey[]
  >(DEFAULT_PLAYBOOK_CATEGORIES);
  const [quietMode, setQuietMode] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const inFlight = useRef(false);
  const knownIds = useRef(new Set(initialCatalysts.map((c) => c.id)));

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

  const softRefetch = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/catalysts?limit=50", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json();
      if (res.status === 429) {
        setPollError(data.error ?? "Rate limited — polling will retry.");
        return;
      }
      if (!res.ok) {
        throw new Error(data.error ?? "Could not refresh feed.");
      }
      const next: FeedCatalyst[] = (data.catalysts ?? []).map(toFeedCatalyst);
      const fresh = next
        .filter((c) => !knownIds.current.has(c.id))
        .map((c) => c.id);
      if (fresh.length > 0) {
        for (const id of next.map((c) => c.id)) knownIds.current.add(id);
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
        for (const id of next.map((c) => c.id)) knownIds.current.add(id);
      }
      setCatalysts(next);
      setLastFetchedAt(data.fetchedAt ?? new Date().toISOString());
      setPollError(null);
    } catch (err) {
      setPollError(
        err instanceof Error ? err.message : "Could not refresh feed.",
      );
    } finally {
      inFlight.current = false;
    }
  }, []);

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
            void softRefetch();
          }, 0)
        : null;

    const id = window.setInterval(() => {
      void softRefetch();
    }, intervalMs);

    return () => {
      if (immediateId !== null) window.clearTimeout(immediateId);
      window.clearInterval(id);
    };
  }, [presence, softRefetch]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

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
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      writeDismissedIds(next);
      return next;
    });
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const categoryOptions = useMemo(() => {
    const counts = new Map<EventCategoryKey, number>();
    for (const c of catalysts) {
      if (!c.eventCategory) continue;
      counts.set(c.eventCategory, (counts.get(c.eventCategory) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([category, count]) => ({ category, count }));
  }, [catalysts]);

  const windowHours =
    TIME_WINDOWS.find((w) => w.id === timeWindow)?.hours ?? null;

  const filtered = useMemo(() => {
    const q = tickerQuery.trim().toUpperCase();
    return catalysts.filter((c) => {
      if (dismissedIds.has(c.id)) return false;
      if (
        !matchesQuietPlaybook(
          { ticker: c.ticker, eventCategory: c.eventCategory },
          { quietMode, watchlistTickers, playbookCategories },
        )
      ) {
        return false;
      }
      if (categoryFilter && c.eventCategory !== categoryFilter) return false;
      if (q && !(c.ticker ?? "").toUpperCase().includes(q)) return false;
      if (!isWithinWindow(c.timestamp, windowHours, nowTick)) return false;
      return true;
    });
  }, [
    catalysts,
    categoryFilter,
    tickerQuery,
    windowHours,
    nowTick,
    dismissedIds,
    quietMode,
    watchlistTickers,
    playbookCategories,
  ]);

  const selected = selectedId
    ? (catalysts.find((c) => c.id === selectedId) ?? null)
    : null;

  const filtersActive =
    Boolean(tickerQuery.trim()) ||
    categoryFilter !== null ||
    timeWindow !== "all" ||
    quietMode;

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
      aria-label="Latest News"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--desk-border)] bg-[var(--desk-header)] px-4 py-3.5 sm:px-5">
        <h1 className="text-[1.05rem] font-semibold tracking-tight text-[var(--desk-text)]">
          Live tape
        </h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => void toggleQuietMode()}
            disabled={!prefsLoaded}
            title="Only show watchlist tickers that match your playbook categories"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.82rem] font-medium transition-colors",
              quietMode
                ? "border-[var(--desk-live)]/45 bg-[var(--desk-live)]/10 text-[var(--desk-live)]"
                : "border-[var(--desk-border-strong)] bg-white/[0.02] text-[var(--desk-text-secondary)] hover:bg-white/[0.05] hover:text-[var(--desk-text)]",
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
                : "border-[var(--desk-border-strong)] bg-white/[0.02] text-[var(--desk-text-secondary)] hover:bg-white/[0.05] hover:text-[var(--desk-text)]",
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
          {lastUpdatedLabel ? (
            <span className="hidden font-mono text-[0.78rem] text-[var(--desk-text-dim)] tabular-nums sm:inline">
              Last updated: {lastUpdatedLabel}
            </span>
          ) : null}
          <button
            type="button"
            aria-label="Refresh"
            onClick={() => void softRefetch()}
            className="grid size-[34px] place-items-center rounded-lg border border-[var(--desk-border-strong)] text-[var(--desk-text-muted)] transition-colors hover:bg-white/[0.05] hover:text-[var(--desk-text)]"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {filtersOpen ? (
        <div className="border-b border-[var(--desk-border)] bg-[var(--desk-header)]/80 px-4 py-3 sm:px-5">
          <FeedFilters
            tickerQuery={tickerQuery}
            onTickerQuery={setTickerQuery}
            categoryFilter={categoryFilter}
            onCategoryFilter={setCategoryFilter}
            categoryOptions={categoryOptions}
            timeWindow={timeWindow}
            onTimeWindow={setTimeWindow}
            quietMode={quietMode}
            watchlistCount={watchlistTickers.length}
            playbookCount={playbookCategories.length}
          />
        </div>
      ) : null}

      {pollError ? (
        <p className="border-b border-[var(--desk-border)] px-4 py-2 font-mono text-xs text-[var(--desk-live)] sm:px-5">
          {pollError}
        </p>
      ) : null}

      {catalysts.length === 0 ? (
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
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-12 text-center">
          <p className="font-mono text-sm text-[var(--desk-text-muted)]">
            {quietMode
              ? "Quiet playbook: no watchlist/playbook matches right now."
              : "No rows match these filters."}
          </p>
        </div>
      ) : (
        <CatalystFeedList
          catalysts={filtered}
          flashIds={flashIds}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAct={setSelectedId}
          onDismiss={dismissCatalyst}
        />
      )}

      <CatalystDetailDrawer
        catalyst={selected}
        onClose={() => setSelectedId(null)}
        onAct={() => {
          if (selectedId !== null) setSelectedId(selectedId);
        }}
        onDismiss={() => {
          if (selectedId !== null) dismissCatalyst(selectedId);
        }}
      />
    </section>
  );
}

interface FeedFiltersProps {
  tickerQuery: string;
  onTickerQuery: (v: string) => void;
  categoryFilter: EventCategoryKey | null;
  onCategoryFilter: (v: EventCategoryKey | null) => void;
  categoryOptions: { category: EventCategoryKey; count: number }[];
  timeWindow: TimeWindow;
  onTimeWindow: (v: TimeWindow) => void;
  quietMode: boolean;
  watchlistCount: number;
  playbookCount: number;
}

function FeedFilters({
  tickerQuery,
  onTickerQuery,
  categoryFilter,
  onCategoryFilter,
  categoryOptions,
  timeWindow,
  onTimeWindow,
  quietMode,
  watchlistCount,
  playbookCount,
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
          value={tickerQuery}
          onChange={(e) => onTickerQuery(e.target.value)}
          placeholder="Ticker…"
          aria-label="Filter by ticker"
          className="h-8 w-36 border-[var(--desk-border-strong)] bg-white/[0.02] font-mono text-xs tracking-wide uppercase md:text-xs"
        />
        <div className="flex flex-wrap items-center gap-1">
          {TIME_WINDOWS.map((w) => (
            <FilterChip
              key={w.id}
              active={timeWindow === w.id}
              onClick={() => onTimeWindow(w.id)}
            >
              {w.label}
            </FilterChip>
          ))}
        </div>
      </div>
      {categoryOptions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          <FilterChip
            active={categoryFilter === null}
            onClick={() => onCategoryFilter(null)}
          >
            All sectors
          </FilterChip>
          {categoryOptions.map(({ category, count }) => (
            <FilterChip
              key={category}
              active={categoryFilter === category}
              onClick={() =>
                onCategoryFilter(categoryFilter === category ? null : category)
              }
            >
              {CATEGORY_LABELS[category]}
              <span className="ml-1 opacity-60">{count}</span>
            </FilterChip>
          ))}
        </div>
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
          ? "border-white/35 bg-white/[0.08] text-[var(--desk-text)]"
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
  selectedId,
  onSelect,
  onAct,
  onDismiss,
}: {
  catalysts: FeedCatalyst[];
  flashIds: Set<number>;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAct: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-auto"
      role="table"
      aria-label="News feed"
    >
      <div
        role="row"
        className={cn(
          "sticky top-0 z-[2] grid h-10 items-center gap-2 border-b border-[var(--desk-border-strong)] bg-[#0c0c0c] px-4 font-mono text-[0.62rem] font-medium tracking-[0.12em] text-[var(--desk-text-dim)] uppercase shadow-[0_1px_0_rgba(0,0,0,0.35)] sm:gap-3 sm:px-5",
          FEED_GRID,
        )}
      >
        <div role="columnheader" className="hidden sm:block">
          Ticker
        </div>
        <div role="columnheader" className="hidden sm:block">
          Event
        </div>
        <div role="columnheader" className="hidden sm:block">
          Impact
        </div>
        <div role="columnheader" className="col-span-1">
          Title
        </div>
        <div role="columnheader" className="hidden sm:block">
          Proof
        </div>
        <div role="columnheader" className="hidden text-right sm:block">
          Time
        </div>
        <div role="columnheader" className="hidden text-right lg:block">
          Action
        </div>
      </div>

      <div className="flex flex-col">
        {catalysts.map((catalyst, index) => {
          const flashing = flashIds.has(catalyst.id);
          const selected = selectedId === catalyst.id;
          const eventLabel = feedEventLabel(catalyst);
          const source = sourceDisplay(catalyst);
          return (
            <article
              key={catalyst.id}
              role="row"
              tabIndex={0}
              onClick={() => onSelect(catalyst.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(catalyst.id);
                }
              }}
              className={cn(
                "feed-row group grid min-h-[56px] cursor-pointer items-center gap-2 border-b border-white/[0.06] px-4 py-3 transition-colors duration-100 outline-none sm:gap-3 sm:px-5 sm:py-0",
                FEED_GRID,
                "hover:bg-white/[0.04] focus-visible:bg-white/[0.04] focus-visible:shadow-[inset_2px_0_0_var(--desk-live)]",
                selected && "bg-white/[0.05]",
                flashing && "row-flash",
              )}
              style={{ animationDelay: `${Math.min(index, 28) * 22}ms` }}
            >
              <div role="cell" className="hidden min-w-0 sm:block">
                <span className="truncate font-mono text-[0.88rem] font-semibold tracking-tight text-[var(--desk-text)]">
                  {catalyst.ticker ?? "—"}
                </span>
              </div>

              <div role="cell" className="hidden min-w-0 sm:block">
                <span
                  className="inline-flex max-w-full truncate rounded-sm border border-[var(--desk-border-strong)] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[0.68rem] text-[var(--desk-text-secondary)]"
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
                <MaterialityBadge
                  score={catalyst.impactScore}
                  category={catalyst.eventCategory}
                />
              </div>

              <div role="cell" className="min-w-0">
                <span className="block text-[0.86rem] font-medium tracking-tight text-[var(--desk-text-secondary)] group-hover:text-[var(--desk-text)] group-focus-visible:text-[var(--desk-text)] max-sm:line-clamp-2 sm:truncate">
                  {titleLine(catalyst)}
                </span>
                <span className="mt-0.5 hidden truncate font-mono text-[0.62rem] tracking-wide text-[var(--desk-text-dim)] sm:block">
                  {source.name}
                  {catalyst.tags.length > 0
                    ? ` · ${catalyst.tags.slice(0, 3).join(" · ")}`
                    : ""}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-2 sm:hidden">
                  <span className="font-mono text-[0.8rem] font-semibold text-[var(--desk-text)]">
                    {catalyst.ticker ?? "—"}
                  </span>
                  <span className="font-mono text-[0.68rem] text-[var(--desk-text-dim)]">
                    {eventLabel}
                  </span>
                  <span className="font-mono text-[0.62rem] text-[var(--desk-text-dim)]">
                    {source.name}
                  </span>
                  <MaterialityBadge
                    score={catalyst.impactScore}
                    category={catalyst.eventCategory}
                  />
                  <EdgarProofLink url={catalyst.sourceUrl} compact />
                  <time
                    dateTime={catalyst.timestamp}
                    className="ml-auto font-mono text-[0.72rem] font-medium tracking-tight text-[var(--desk-text-muted)] tabular-nums"
                  >
                    {formatClockTime(catalyst.timestamp)}
                  </time>
                </span>
                <div
                  className="mt-2 flex flex-wrap items-center gap-1.5 lg:hidden"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onAct(catalyst.id)}
                    className="inline-flex items-center gap-1 rounded-sm bg-[var(--desk-live)] px-2 py-0.5 font-mono text-[0.65rem] font-semibold tracking-wide text-[#121212] uppercase hover:brightness-110"
                  >
                    <Check className="size-3" />
                    Act
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismiss(catalyst.id)}
                    className="inline-flex items-center gap-1 rounded-sm border border-[var(--desk-border-strong)] px-2 py-0.5 font-mono text-[0.65rem] tracking-wide text-[var(--desk-text-muted)] uppercase hover:bg-white/[0.05] hover:text-[var(--desk-text)]"
                  >
                    <X className="size-3" />
                    Dismiss
                  </button>
                </div>
              </div>

              <div
                role="cell"
                className="hidden min-w-0 sm:block"
                onClick={(e) => e.stopPropagation()}
              >
                <EdgarProofLink url={catalyst.sourceUrl} compact />
              </div>

              <div role="cell" className="hidden min-w-0 text-right sm:block">
                <time
                  dateTime={catalyst.timestamp}
                  className="inline-block font-mono text-[0.72rem] font-medium tracking-tight whitespace-nowrap text-[var(--desk-text-dim)] tabular-nums"
                >
                  {formatTimeDate(catalyst.timestamp)}
                </time>
              </div>

              <div
                role="cell"
                className="hidden justify-end gap-1.5 lg:flex"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => onAct(catalyst.id)}
                  className="inline-flex items-center gap-1 rounded-sm bg-[var(--desk-live)] px-2 py-0.5 font-mono text-[0.65rem] font-semibold tracking-wide text-[#121212] uppercase hover:brightness-110"
                >
                  Act
                </button>
                <button
                  type="button"
                  onClick={() => onDismiss(catalyst.id)}
                  className="inline-flex items-center gap-1 rounded-sm border border-[var(--desk-border-strong)] px-2 py-0.5 font-mono text-[0.65rem] tracking-wide text-[var(--desk-text-muted)] uppercase hover:bg-white/[0.05] hover:text-[var(--desk-text)]"
                >
                  Dismiss
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
