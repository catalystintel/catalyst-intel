"use client";

import Link from "next/link";

import type { TickerStat } from "@/lib/catalysts/analytics";

/**
 * Ranked ticker list by catalyst count. Each row links into the Live tape
 * pre-filtered to that ticker, so Analytics acts as a jumping-off point
 * back into the tape rather than a dead-end summary.
 */
export function TopTickersWidget({ tickers }: { tickers: TickerStat[] }) {
  if (tickers.length === 0) {
    return (
      <p className="py-6 text-center font-mono text-xs text-[var(--desk-text-dim)]">
        No tickers in this window yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-[var(--desk-border)]">
      {tickers.map((t, index) => (
        <li key={t.ticker}>
          <Link
            href={`/catalyst-feed?ticker=${encodeURIComponent(t.ticker)}`}
            className="flex items-center gap-3 py-2.5 transition-colors hover:bg-[var(--desk-overlay-soft)]"
          >
            <span className="w-5 shrink-0 font-mono text-[0.72rem] text-[var(--desk-text-dim)] tabular-nums">
              {index + 1}
            </span>
            <span className="flex-1 truncate font-mono text-sm font-semibold text-[var(--desk-text)]">
              {t.ticker}
            </span>
            <span className="shrink-0 font-mono text-[0.72rem] text-[var(--desk-text-muted)] tabular-nums">
              {t.count} {t.count === 1 ? "catalyst" : "catalysts"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
