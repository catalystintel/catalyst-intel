"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, ListFilter, RefreshCw } from "lucide-react";

import { CatalystDetailDrawer } from "@/components/catalyst-detail-drawer";
import { SectorPill } from "@/components/sector-pill";
import { Input } from "@/components/ui/input";
import {
  toFeedCatalyst,
  type FeedCatalyst,
} from "@/lib/catalysts/feed-catalyst";
import {
  sectorLabel,
  sectorTone,
  sourceDisplay,
  titleLine,
} from "@/lib/catalysts/feed-display";
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

type Presence = "active" | "blurred" | "hidden";
type TimeWindow = "1h" | "4h" | "24h" | "all";

const TIME_WINDOWS: { id: TimeWindow; label: string; hours: number | null }[] =
  [
    { id: "1h", label: "1h", hours: 1 },
    { id: "4h", label: "4h", hours: 4 },
    { id: "24h", label: "24h", hours: 24 },
    { id: "all", label: "All", hours: null },
  ];

const FEED_GRID =
  "grid-cols-1 sm:grid-cols-[148px_132px_minmax(0,1fr)_150px] lg:grid-cols-[168px_148px_minmax(0,1fr)_168px]";

function readPresence(): Presence {
  if (typeof document === "undefined") return "active";
  if (document.visibilityState === "hidden") return "hidden";
  if (typeof document.hasFocus === "function" && !document.hasFocus()) {
    return "blurred";
  }
  return "active";
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
  const inFlight = useRef(false);
  const knownIds = useRef(new Set(initialCatalysts.map((c) => c.id)));

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
      if (categoryFilter && c.eventCategory !== categoryFilter) return false;
      if (q && !(c.ticker ?? "").toUpperCase().includes(q)) return false;
      if (!isWithinWindow(c.timestamp, windowHours, nowTick)) return false;
      return true;
    });
  }, [catalysts, categoryFilter, tickerQuery, windowHours, nowTick]);

  const selected = selectedId
    ? (catalysts.find((c) => c.id === selectedId) ?? null)
    : null;

  const filtersActive =
    Boolean(tickerQuery.trim()) ||
    categoryFilter !== null ||
    timeWindow !== "all";

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
          Latest News
        </h1>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[0.82rem] font-medium transition-colors",
              filtersOpen || filtersActive
                ? "border-[var(--desk-accent)]/45 bg-[var(--desk-accent)]/10 text-[var(--desk-accent-fg)]"
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
          />
        </div>
      ) : null}

      {pollError ? (
        <p className="border-b border-[var(--desk-border)] px-4 py-2 font-mono text-xs text-amber-400/90 sm:px-5">
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
              ? "Open Admin and run “Fetch SEC EDGAR now” to populate the Live feed."
              : "Filings appear here once an admin runs the first ingestion job."}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-12 text-center">
          <p className="font-mono text-sm text-[var(--desk-text-muted)]">
            No rows match these filters.
          </p>
        </div>
      ) : (
        <CatalystFeedList
          catalysts={filtered}
          flashIds={flashIds}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}

      <CatalystDetailDrawer
        catalyst={selected}
        onClose={() => setSelectedId(null)}
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
}

function FeedFilters({
  tickerQuery,
  onTickerQuery,
  categoryFilter,
  onCategoryFilter,
  categoryOptions,
  timeWindow,
  onTimeWindow,
}: FeedFiltersProps) {
  return (
    <div className="flex flex-col gap-2.5">
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
          ? "border-[var(--desk-accent)]/55 bg-[var(--desk-accent)]/12 text-[var(--desk-accent-fg)]"
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
}: {
  catalysts: FeedCatalyst[];
  flashIds: Set<number>;
  selectedId: number | null;
  onSelect: (id: number) => void;
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
          "sticky top-0 z-[2] grid h-10 items-center gap-3 border-b border-[var(--desk-border-strong)] bg-[#0f1620] px-4 font-mono text-[0.66rem] font-medium tracking-[0.12em] text-[#6d7d92] uppercase shadow-[0_1px_0_rgba(0,0,0,0.25)] sm:gap-4 sm:px-5",
          FEED_GRID,
        )}
      >
        <div role="columnheader" className="hidden sm:block">
          Source
        </div>
        <div role="columnheader" className="hidden sm:block">
          Sector
        </div>
        <div role="columnheader" className="col-span-1 sm:col-span-1">
          Title
        </div>
        <div role="columnheader" className="hidden text-right sm:block">
          Time
        </div>
      </div>

      <div className="flex flex-col">
        {catalysts.map((catalyst, index) => {
          const flashing = flashIds.has(catalyst.id);
          const selected = selectedId === catalyst.id;
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
                "feed-row group grid min-h-[60px] cursor-pointer items-center gap-3 border-b border-[rgba(28,39,54,0.95)] px-4 py-3 transition-colors duration-100 outline-none sm:gap-4 sm:px-5 sm:py-0",
                FEED_GRID,
                "hover:bg-white/[0.045] focus-visible:bg-white/[0.045] focus-visible:shadow-[inset_2px_0_0_var(--desk-accent)]",
                selected && "bg-[var(--desk-accent)]/[0.08]",
                flashing && "row-flash",
              )}
              style={{ animationDelay: `${Math.min(index, 28) * 22}ms` }}
            >
              <div
                role="cell"
                className="col-source hidden min-w-0 items-center gap-2.5 sm:flex"
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-[7px] text-[0.7rem] font-bold text-white",
                    source.tone === "sec"
                      ? "bg-[#1a4a7a]"
                      : "bg-[#1e2430] shadow-[inset_0_0_0_1px_#3a4558]",
                  )}
                >
                  {source.initial}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[0.86rem] font-semibold text-[var(--desk-text)]">
                    {source.name}
                  </span>
                  <span className="truncate text-[0.72rem] text-[var(--desk-text-dim)]">
                    {source.meta}
                  </span>
                </span>
              </div>

              <div role="cell" className="hidden min-w-0 sm:block">
                <SectorPill
                  tone={sectorTone(catalyst)}
                  label={sectorLabel(catalyst)}
                />
              </div>

              <div role="cell" className="min-w-0">
                <span className="block text-[0.9rem] font-medium tracking-tight text-[var(--desk-text-secondary)] group-hover:text-[var(--desk-text)] group-focus-visible:text-[var(--desk-text)] max-sm:line-clamp-2 sm:truncate">
                  {titleLine(catalyst)}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-2 sm:hidden">
                  <SectorPill
                    tone={sectorTone(catalyst)}
                    label={sectorLabel(catalyst)}
                  />
                  <span className="truncate text-[0.72rem] text-[var(--desk-text-dim)]">
                    {source.name}
                  </span>
                  <time
                    dateTime={catalyst.timestamp}
                    className="ml-auto font-mono text-[0.72rem] font-medium tracking-tight text-[var(--desk-text-muted)] tabular-nums"
                  >
                    {formatClockTime(catalyst.timestamp)}
                  </time>
                </span>
              </div>

              <div role="cell" className="hidden min-w-0 text-right sm:block">
                <time
                  dateTime={catalyst.timestamp}
                  className="inline-block font-mono text-[0.74rem] font-medium tracking-tight whitespace-nowrap text-[var(--desk-text-muted)] tabular-nums"
                >
                  {formatTimeDate(catalyst.timestamp)}
                </time>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
