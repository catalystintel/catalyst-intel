"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { CategoryBreakdownChart } from "@/components/analytics/category-breakdown-chart";
import { StatStrip } from "@/components/analytics/stat-strip";
import { TopSymbolsWidget } from "@/components/analytics/top-symbols-widget";
import { VolumeTrendChart } from "@/components/analytics/volume-trend-chart";
import { SkeletonCard } from "@/components/loading-skeleton";
import type { AnalyticsSummary } from "@/lib/catalysts/analytics";
import {
  ANALYTICS_WINDOWS,
  type AnalyticsWindow,
} from "@/lib/catalysts/analytics-window";
import { cn } from "@/lib/utils";
import { toUserFacingMessage } from "@/lib/errors/user-facing";

const REFRESH_MS = 60_000;

export function AnalyticsDashboard() {
  const [window_, setWindow] = useState<AnalyticsWindow>("24h");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (win: AnalyticsWindow, isManual = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch(`/api/analytics?window=${win}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load analytics.");
      setSummary(data.summary);
      setLastFetchedAt(data.fetchedAt ?? new Date().toISOString());
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(toUserFacingMessage(err, "Could not load analytics."));
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Defer so `load`'s setState calls are not synchronous in the effect
    // body (react-hooks/set-state-in-effect) - same pattern as
    // watchlists/watchlist-hub.tsx's initial load.
    const id = window.setTimeout(() => {
      void load(window_);
    }, 0);
    return () => window.clearTimeout(id);
  }, [window_, load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(window_), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [window_, load]);

  const lastUpdatedLabel = lastFetchedAt
    ? new Date(lastFetchedAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <section className="flex flex-1 flex-col gap-5 overflow-y-auto p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[var(--desk-text)]">
            Analytics
          </h1>
          <p className="mt-0.5 text-sm text-[var(--desk-text-muted)]">
            Aggregate view of catalyst volume and coverage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ANALYTICS_WINDOWS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setWindow(w.id)}
              className={cn(
                "inline-flex h-8 items-center rounded-md border px-3 font-mono text-[0.72rem] tracking-wide transition-colors",
                window_ === w.id
                  ? "border-[var(--desk-text-dim)] bg-[var(--desk-overlay-strong)] text-[var(--desk-text)]"
                  : "border-[var(--desk-border)] bg-transparent text-[var(--desk-text-muted)] hover:border-[var(--desk-border-strong)] hover:text-[var(--desk-text)]",
              )}
            >
              {w.label}
            </button>
          ))}
          {lastUpdatedLabel ? (
            <span className="hidden font-mono text-[0.72rem] text-[var(--desk-text-dim)] tabular-nums sm:inline">
              Updated {lastUpdatedLabel}
            </span>
          ) : null}
          <button
            type="button"
            aria-label="Refresh"
            aria-busy={refreshing}
            onClick={() => void load(window_, true)}
            disabled={refreshing}
            className="btn-press grid size-8 place-items-center rounded-md border border-[var(--desk-border-strong)] text-[var(--desk-text-muted)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)] disabled:cursor-default disabled:opacity-70"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      {loading || !summary ? (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <SkeletonCard key={i} lines={1} />
            ))}
          </div>
          <SkeletonCard lines={5} />
          <SkeletonCard lines={5} />
        </div>
      ) : (
        <>
          <StatStrip
            totalCount={summary.totalCount}
            activeSymbolCount={summary.activeSymbolCount}
          />

          <Panel title="Catalysts by category">
            <CategoryBreakdownChart data={summary.categoryCounts} />
          </Panel>

          <Panel title="Volume over time">
            <VolumeTrendChart data={summary.volumeSeries} window={window_} />
          </Panel>

          <Panel title="Top symbols">
            <TopSymbolsWidget symbols={summary.topSymbols} />
          </Panel>
        </>
      )}
    </section>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)] p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-[var(--desk-text)]">
        {title}
      </h2>
      {children}
    </div>
  );
}
