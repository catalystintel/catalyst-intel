"use client";

import { useWatchlistQuotes } from "@/hooks/use-watchlist-quotes";
import { cn } from "@/lib/utils";

/**
 * Bottom scrolling ticker strip — maps to the reference image's bottom
 * symbol/price/change ticker tape. Real data only: renders your watchlist
 * symbols with the same session quote the split panel / Watchlist rail use.
 * Renders nothing when the watchlist is empty rather than inventing tickers.
 */
export function DashboardTickerTape({ symbols }: { symbols: string[] }) {
  const { quotes } = useWatchlistQuotes(symbols);

  if (symbols.length === 0) return null;

  return (
    <div
      className="flex shrink-0 items-center gap-6 overflow-x-auto rounded-lg border border-[var(--desk-border)] bg-[var(--desk-header)] px-4 py-2"
      role="list"
      aria-label="Watchlist ticker tape"
    >
      {symbols.map((symbol) => {
        const quote = quotes[symbol.toUpperCase()];
        const up =
          quote?.change == null
            ? null
            : quote.change > 0
              ? true
              : quote.change < 0
                ? false
                : null;
        return (
          <div
            key={symbol}
            role="listitem"
            className="desk-data flex shrink-0 items-center gap-1.5 whitespace-nowrap"
          >
            <span className="font-semibold text-[var(--desk-text)]">
              {symbol}
            </span>
            {quote?.price != null ? (
              <span className="text-[var(--desk-text-muted)]">
                {quote.price.toFixed(2)}
              </span>
            ) : null}
            {quote?.change != null && quote?.changePercent != null ? (
              <span
                className={cn(
                  up === true && "text-[var(--desk-positive)]",
                  up === false && "text-[var(--desk-negative)]",
                  up == null && "text-[var(--desk-text-dim)]",
                )}
              >
                {quote.change > 0 ? "+" : ""}
                {quote.change.toFixed(2)} ({quote.change > 0 ? "+" : ""}
                {quote.changePercent.toFixed(2)}%)
              </span>
            ) : (
              <span className="text-[var(--desk-text-dim)]">…</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
