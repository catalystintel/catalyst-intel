"use client";

import { useState } from "react";
import { LineChart } from "lucide-react";

import { TradingViewAdvancedChart } from "@/components/tradingview-advanced-chart";
import { Input } from "@/components/ui/input";
import { toTradingViewSymbol } from "@/lib/catalysts/enrich-article-format";
import {
  DEFAULT_CHART_RANGE,
  type ChartRangeKey,
} from "@/lib/market/chart-range";

/**
 * "CHARTING" panel — a persistent, dedicated chart on the dashboard's right
 * column, always focused on `symbol` (updated by the Watchlist rail or by
 * opening a Live tape row's split panel — see `onFocusSymbol` wiring in
 * `LiveCatalystFeed` / `DashboardWatchlistRail`). Same real TradingView
 * embed + timeframe chips the split panel already uses — not a mock chart.
 */
export function DashboardChartingPanel({
  symbol,
  onSymbolChange,
}: {
  symbol: string | null;
  onSymbolChange?: (symbol: string) => void;
}) {
  const [range, setRange] = useState<ChartRangeKey>(DEFAULT_CHART_RANGE);
  const [draft, setDraft] = useState("");

  function submitDraft(e: React.FormEvent) {
    e.preventDefault();
    const next = draft.trim().toUpperCase();
    if (!next) return;
    onSymbolChange?.(next);
    setDraft("");
  }

  const tvSymbol = symbol ? toTradingViewSymbol(symbol, null) : null;

  return (
    <section className="flex min-h-[240px] flex-1 flex-col overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--desk-border)] bg-[var(--desk-header)] px-3 py-2.5">
        <h2 className="flex items-center gap-1.5 font-mono text-[0.7rem] font-semibold tracking-[0.14em] text-[var(--desk-text)] uppercase">
          <LineChart className="size-3.5 text-[var(--desk-chart-accent)]" />
          Charting
          {symbol ? (
            <span className="text-[var(--desk-live)]">· {symbol}</span>
          ) : null}
        </h2>
        <form onSubmit={submitDraft} className="flex items-center gap-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Symbol…"
            aria-label="Chart a symbol"
            className="h-6 w-20 border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-1.5 font-mono text-[0.65rem] uppercase"
          />
        </form>
      </div>

      {tvSymbol ? (
        <div className="min-h-0 flex-1 bg-[#0b0d10]">
          <TradingViewAdvancedChart
            key={tvSymbol}
            symbol={tvSymbol}
            range={range}
            onRangeChange={setRange}
            className="h-full min-h-[240px]"
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
          <LineChart className="size-6 text-[var(--desk-text-dim)]" />
          <p className="max-w-[220px] text-[0.78rem] leading-snug text-[var(--desk-text-muted)]">
            Select a symbol from Watchlists, or open a tape row, to chart it
            here.
          </p>
        </div>
      )}
    </section>
  );
}
