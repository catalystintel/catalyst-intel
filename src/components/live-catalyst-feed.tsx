"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { CatalystDetailDrawer } from "@/components/catalyst-detail-drawer";
import { Input } from "@/components/ui/input";
import {
  formatRelativeAge,
  isWithinWindow,
} from "@/lib/format/relative-time";
import { cn } from "@/lib/utils";

export type FeedCatalyst = {
  id: number;
  ticker: string | null;
  type: string;
  title: string;
  timestamp: string;
  summary: string | null;
  impactScore: number | null;
  sourceUrl: string | null;
};

const ACTIVE_POLL_MS = 20_000;
const BLURRED_POLL_MS = 90_000;

type Presence = "active" | "blurred" | "hidden";
type TimeWindow = "1h" | "4h" | "24h" | "all";

const TIME_WINDOWS: { id: TimeWindow; label: string; hours: number | null }[] = [
  { id: "1h", label: "1h", hours: 1 },
  { id: "4h", label: "4h", hours: 4 },
  { id: "24h", label: "24h", hours: 24 },
  { id: "all", label: "All", hours: null },
];

function readPresence(): Presence {
  if (typeof document === "undefined") return "active";
  if (document.visibilityState === "hidden") return "hidden";
  if (typeof document.hasFocus === "function" && !document.hasFocus()) {
    return "blurred";
  }
  return "active";
}

function whyLine(c: FeedCatalyst): string {
  const summary = c.summary?.trim();
  if (summary) return summary;
  return c.title;
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
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("all");
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
      const next: FeedCatalyst[] = data.catalysts ?? [];
      const fresh = next.filter((c) => !knownIds.current.has(c.id)).map((c) => c.id);
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
      setPollError(err instanceof Error ? err.message : "Could not refresh feed.");
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

  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of catalysts) {
      counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([type, count]) => ({ type, count }));
  }, [catalysts]);

  const windowHours =
    TIME_WINDOWS.find((w) => w.id === timeWindow)?.hours ?? null;

  const filtered = useMemo(() => {
    const q = tickerQuery.trim().toUpperCase();
    return catalysts.filter((c) => {
      if (typeFilter && c.type !== typeFilter) return false;
      if (q && !(c.ticker ?? "").toUpperCase().includes(q)) return false;
      if (!isWithinWindow(c.timestamp, windowHours, nowTick)) return false;
      return true;
    });
  }, [catalysts, typeFilter, tickerQuery, windowHours, nowTick]);

  const selected = selectedId
    ? (catalysts.find((c) => c.id === selectedId) ?? null)
    : null;

  const statusLabel =
    presence === "hidden"
      ? "Paused"
      : presence === "blurred"
        ? "Slow"
        : "LIVE";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5 font-mono text-xs">
          <span
            aria-hidden
            className={cn(
              "inline-block size-2 rounded-full",
              presence === "active" ? "live-pulse bg-amber-400" : "bg-muted-foreground/45",
            )}
          />
          <span
            className={cn(
              "tracking-[0.16em]",
              presence === "active" ? "text-amber-400" : "text-muted-foreground",
            )}
          >
            {statusLabel}
          </span>
          {lastFetchedAt ? (
            <span className="text-muted-foreground tabular-nums">
              · sync {new Date(lastFetchedAt).toLocaleTimeString()}
            </span>
          ) : null}
        </div>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {filtered.length}
          {filtered.length !== catalysts.length ? ` / ${catalysts.length}` : ""} rows
        </span>
      </div>

      <FeedFilters
        tickerQuery={tickerQuery}
        onTickerQuery={setTickerQuery}
        typeFilter={typeFilter}
        onTypeFilter={setTypeFilter}
        typeOptions={typeOptions}
        timeWindow={timeWindow}
        onTimeWindow={setTimeWindow}
      />

      {pollError ? (
        <p className="font-mono text-xs text-amber-400/90">{pollError}</p>
      ) : null}

      {catalysts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 border border-dashed border-border/70 bg-[oklch(0.18_0.016_255)] px-6 py-16 text-center">
          <p className="font-mono text-sm text-foreground">No catalysts yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {isAdmin
              ? "Open Admin and run “Fetch SEC EDGAR now” to populate the Live feed."
              : "Filings appear here once an admin runs the first ingestion job."}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border/70 px-6 py-12 text-center">
          <p className="font-mono text-sm text-muted-foreground">
            No rows match these filters.
          </p>
        </div>
      ) : (
        <CatalystFeedList
          catalysts={filtered}
          flashIds={flashIds}
          nowTick={nowTick}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}

      <CatalystDetailDrawer
        catalyst={selected}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function FeedFilters({
  tickerQuery,
  onTickerQuery,
  typeFilter,
  onTypeFilter,
  typeOptions,
  timeWindow,
  onTimeWindow,
}: {
  tickerQuery: string;
  onTickerQuery: (v: string) => void;
  typeFilter: string | null;
  onTypeFilter: (v: string | null) => void;
  typeOptions: { type: string; count: number }[];
  timeWindow: TimeWindow;
  onTimeWindow: (v: TimeWindow) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={tickerQuery}
          onChange={(e) => onTickerQuery(e.target.value)}
          placeholder="Ticker…"
          aria-label="Filter by ticker"
          className="h-8 w-36 font-mono text-xs uppercase tracking-wide md:text-xs"
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
      {typeOptions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          <FilterChip active={typeFilter === null} onClick={() => onTypeFilter(null)}>
            All types
          </FilterChip>
          {typeOptions.map(({ type, count }) => (
            <FilterChip
              key={type}
              active={typeFilter === type}
              onClick={() => onTypeFilter(typeFilter === type ? null : type)}
            >
              {type}
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
        "btn-press inline-flex h-7 items-center rounded-md border px-2.5 font-mono text-[0.7rem] tracking-wide transition-colors",
        active
          ? "border-amber-400/55 bg-amber-400/12 text-amber-200"
          : "border-border/70 bg-transparent text-muted-foreground hover:border-steel/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function CatalystFeedList({
  catalysts,
  flashIds,
  nowTick,
  selectedId,
  onSelect,
}: {
  catalysts: FeedCatalyst[];
  flashIds: Set<number>;
  nowTick: number;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="overflow-hidden border border-border/70 bg-[oklch(0.175_0.016_255)]">
      <div className="grid grid-cols-[4.5rem_4.25rem_3.5rem_3rem_minmax(0,1fr)] gap-2 border-b border-border/60 bg-[oklch(0.19_0.018_255)] px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground sm:grid-cols-[5.5rem_5rem_4rem_3.5rem_minmax(0,1fr)] sm:gap-3 sm:px-4">
        <span>Ticker</span>
        <span>Type</span>
        <span>Impact</span>
        <span className="text-right">Age</span>
        <span>Why</span>
      </div>
      <ul className="divide-y divide-border/40">
        {catalysts.map((catalyst, index) => {
          const flashing = flashIds.has(catalyst.id);
          const selected = selectedId === catalyst.id;
          return (
            <li key={catalyst.id}>
              <button
                type="button"
                onClick={() => onSelect(catalyst.id)}
                className={cn(
                  "feed-row grid w-full grid-cols-[4.5rem_4.25rem_3.5rem_3rem_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 text-left transition-colors sm:grid-cols-[5.5rem_5rem_4rem_3.5rem_minmax(0,1fr)] sm:gap-3 sm:px-4 sm:py-3",
                  "hover:bg-amber-400/[0.05] focus-visible:bg-amber-400/[0.07] focus-visible:outline-none",
                  selected && "bg-steel/15",
                  flashing && "row-flash",
                )}
                style={{ animationDelay: `${Math.min(index, 28) * 22}ms` }}
              >
                <span className="truncate font-mono text-[0.8rem] font-semibold tracking-wide text-steel-foreground">
                  {catalyst.ticker ?? "—"}
                </span>
                <span className="truncate font-mono text-[0.7rem] text-muted-foreground">
                  {catalyst.type}
                </span>
                <span className="font-mono text-[0.7rem] tabular-nums text-muted-foreground/80">
                  {catalyst.impactScore != null ? catalyst.impactScore : "—"}
                </span>
                <time
                  dateTime={catalyst.timestamp}
                  className="text-right font-mono text-[0.7rem] tabular-nums text-amber-200/85"
                >
                  {formatRelativeAge(catalyst.timestamp, nowTick)}
                </time>
                <span className="truncate text-[0.8rem] text-foreground/90">
                  {whyLine(catalyst)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
