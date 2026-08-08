"use client";

import { DeskLightweightChart } from "@/components/desk-lightweight-chart";
import { toTradingViewSymbol } from "@/lib/catalysts/enrich-article-format";
import type { ChartRangeKey } from "@/lib/market/chart-range";
import { cn } from "@/lib/utils";

/**
 * Sibling chart pane for the Live tape desk — hosts the blotter chart outside
 * the triage scroll stack so price action stays visible without scrolling.
 */
export function TapeChartPanel({
  symbol,
  displaySymbol,
  range,
  onRangeChange,
  eventTimeSec = null,
  className,
  chartClassName,
}: {
  symbol: string;
  /** TradingView-style label; falls back to a best-effort map from `symbol`. */
  displaySymbol?: string | null;
  range: ChartRangeKey;
  onRangeChange: (range: ChartRangeKey) => void;
  eventTimeSec?: number | null;
  className?: string;
  chartClassName?: string;
}) {
  const trimmed = symbol.trim().toUpperCase();
  const tvLabel =
    displaySymbol?.trim() || toTradingViewSymbol(trimmed, null) || trimmed;

  return (
    <aside
      aria-label={`${trimmed} chart`}
      className={cn(
        "desk-arial flex min-h-0 flex-col border-[var(--desk-border)] bg-[var(--desk-panel)]",
        className,
      )}
    >
      <DeskLightweightChart
        key={trimmed}
        symbol={trimmed}
        displaySymbol={tvLabel}
        range={range}
        onRangeChange={onRangeChange}
        eventTimeSec={eventTimeSec}
        className={cn("min-h-0 flex-1", chartClassName)}
      />
    </aside>
  );
}
