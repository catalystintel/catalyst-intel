"use client";

import { useEffect, useState } from "react";

export interface WatchlistSymbolQuote {
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

/**
 * Batch-fetches session quotes (`/api/market/quote`, same endpoint the
 * split panel uses) for a list of symbols, capped concurrency. Used by the
 * dashboard Watchlist rail (and any other desk surface that needs the same
 * session quote map).
 */
export function useWatchlistQuotes(symbols: string[]): {
  quotes: Record<string, WatchlistSymbolQuote>;
  loading: boolean;
} {
  const [quotes, setQuotes] = useState<Record<string, WatchlistSymbolQuote>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const key = symbols.join(",");

  useEffect(() => {
    if (symbols.length === 0) return;
    let cancelled = false;
    void (async () => {
      // Deferred a microtask so this isn't a synchronous setState call
      // within the effect body (avoids cascading-render lint/perf issue).
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      const CONCURRENCY = 4;
      const queue = [...symbols];
      async function worker() {
        while (queue.length > 0 && !cancelled) {
          const next = queue.shift();
          if (!next) return;
          try {
            const res = await fetch(
              `/api/market/quote?symbol=${encodeURIComponent(next)}`,
              { credentials: "same-origin" },
            );
            if (!res.ok || cancelled) continue;
            const data = await res.json();
            if (!cancelled) {
              setQuotes((prev) => ({
                ...prev,
                [next.toUpperCase()]: {
                  price: data?.quote?.price ?? null,
                  change: data?.quote?.change ?? null,
                  changePercent: data?.quote?.changePercent ?? null,
                },
              }));
            }
          } catch {
            // Soft-fail per symbol.
          }
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, symbols.length) }, worker),
      );
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // `key` (stable join) is the real dependency — `symbols` is a new array
    // identity on every render otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { quotes, loading };
}
