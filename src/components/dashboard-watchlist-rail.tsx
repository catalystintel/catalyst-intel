"use client";

import { useCallback, useEffect, useState } from "react";
import { Minus, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/loading-skeleton";
import { useWatchlistQuotes } from "@/hooks/use-watchlist-quotes";
import { cn } from "@/lib/utils";
import { toUserFacingMessage } from "@/lib/errors/user-facing";
import {
  notifyWatchlistChanged,
  subscribeWatchlistChanged,
} from "@/lib/watchlist/watchlist-events";

/**
 * Compact "WATCHLISTS" rail for the dashboard's right column (below Economic
 * Calendar) — maps to `docs/design/dashboard-target-reference-02.png`. Real
 * data: reads/writes the same `/api/watchlist` endpoints as the full
 * Watchlist page and the Live tape's "Watch" action, so adding/removing here
 * stays in sync everywhere else.
 *
 * Trend arrows use `/api/market/quote` (the same quote endpoint the split
 * panel uses) — green up / red down / gray flat by session change %.
 * Clicking a row highlights it and syncs focus with the open tape row (via
 * `onFocusSymbol`); it does not filter the tape — use a row's own
 * "Filter to symbol" action for that (unchanged elsewhere).
 */
export function DashboardWatchlistRail({
  focusSymbol,
  onFocusSymbol,
}: {
  focusSymbol?: string | null;
  onFocusSymbol?: (symbol: string) => void;
}) {
  const [symbols, setSymbols] = useState<{ id: number; symbol: string }[]>([]);
  const { quotes } = useWatchlistQuotes(symbols.map((s) => s.symbol));
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSymbols = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setSymbols(data.symbols ?? []);
    } catch {
      // Soft-fail: rail still usable without a preloaded list.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void loadSymbols(), 0);
    return () => window.clearTimeout(id);
  }, [loadSymbols]);

  useEffect(
    () => subscribeWatchlistChanged(() => void loadSymbols()),
    [loadSymbols],
  );

  async function addSymbol(e: React.FormEvent) {
    e.preventDefault();
    const symbol = draft.trim().toUpperCase();
    if (!symbol) return;
    setSaving(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add symbol.");
      setDraft("");
      await loadSymbols();
      notifyWatchlistChanged();
      onFocusSymbol?.(symbol);
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not add symbol."));
    } finally {
      setSaving(false);
    }
  }

  async function removeSymbol(symbol: string) {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/watchlist?symbol=${encodeURIComponent(symbol)}`,
        { method: "DELETE", credentials: "same-origin" },
      );
      if (!res.ok) throw new Error("Could not remove symbol.");
      await loadSymbols();
      notifyWatchlistChanged();
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not remove symbol."));
    } finally {
      setSaving(false);
    }
  }

  const filtered = symbols.filter((t) =>
    t.symbol.toUpperCase().includes(query.trim().toUpperCase()),
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--desk-border)] bg-[var(--desk-header)] px-3 py-2.5">
        <h2 className="desk-caps font-mono text-[0.7rem] font-semibold tracking-[0.14em] text-[var(--desk-text)] uppercase">
          Watchlists
        </h2>
        <form onSubmit={addSymbol} className="flex items-center gap-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add…"
            aria-label="Add symbol to watchlist"
            className="h-6 w-16 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-1.5 font-mono text-[0.65rem] uppercase"
          />
          <button
            type="submit"
            disabled={saving || !draft.trim()}
            aria-label="Add symbol"
            className="btn-press grid size-6 shrink-0 place-items-center rounded-md bg-[var(--desk-live)] text-[var(--desk-accent-fg)] disabled:opacity-50"
          >
            <Plus className="size-3.5" />
          </button>
        </form>
      </div>

      <div className="border-b border-[var(--desk-border)] px-3 py-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search watchlist…"
          aria-label="Search watchlist"
          className="h-7 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] font-mono text-[0.7rem]"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {!loaded ? (
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-3 font-mono text-[0.7rem] text-[var(--desk-text-dim)]">
            {symbols.length === 0
              ? "No symbols yet — add a ticker above."
              : "No matches."}
          </p>
        ) : (
          <ul className="flex flex-col">
            {filtered.map((t) => {
              const quote = quotes[t.symbol.toUpperCase()];
              const pct = quote?.changePercent ?? null;
              const isFocused = focusSymbol === t.symbol;
              return (
                <li key={t.id}>
                  <div
                    className={cn(
                      "group flex items-center gap-2 border-b border-[var(--desk-border)] px-3 py-2 transition-colors hover:bg-[var(--desk-overlay-soft)]",
                      isFocused && "bg-[var(--desk-overlay-strong)]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onFocusSymbol?.(t.symbol)}
                      className="min-w-0 flex-1 truncate text-left"
                      title={`Focus ${t.symbol}`}
                    >
                      <span className="desk-data font-semibold tracking-tight text-[var(--desk-text)]">
                        {t.symbol}
                      </span>
                    </button>
                    <TrendArrow changePercent={pct} />
                    <button
                      type="button"
                      aria-label={`Remove ${t.symbol}`}
                      disabled={saving}
                      onClick={() => void removeSymbol(t.symbol)}
                      className="shrink-0 text-[var(--desk-text-dim)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--desk-text)]"
                    >
                      <Minus className="size-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function TrendArrow({ changePercent }: { changePercent: number | null }) {
  if (changePercent == null) {
    return (
      <Minus
        className="size-3.5 shrink-0 text-[var(--desk-text-dim)]"
        aria-label="No change data"
      />
    );
  }
  if (changePercent > 0) {
    return (
      <span className="desk-data flex shrink-0 items-center gap-1 text-[var(--desk-positive)]">
        <TrendingUp className="size-3.5" />
        {changePercent.toFixed(1)}%
      </span>
    );
  }
  if (changePercent < 0) {
    return (
      <span className="desk-data flex shrink-0 items-center gap-1 text-[var(--desk-negative)]">
        <TrendingDown className="size-3.5" />
        {changePercent.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="desk-data flex shrink-0 items-center gap-1 text-[var(--desk-text-dim)]">
      <Minus className="size-3.5" />
      0.0%
    </span>
  );
}
