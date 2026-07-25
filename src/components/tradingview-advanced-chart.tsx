"use client";

import { useEffect, useMemo, useState } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";

import {
  CHART_RANGES,
  DEFAULT_CHART_RANGE,
  chartRangeDef,
  type ChartRangeKey,
} from "@/lib/market/chart-range";
import { cn } from "@/lib/utils";

/**
 * TradingView widgetembed `style` codes:
 * 0 bars · 1 candles · 2 line · 3 area · 8 hollow candles · 9 heikin ashi
 * Default to line so the panel opens on a simple price view (not candles).
 */
const DEFAULT_CHART_STYLE = "2";

/**
 * Build TradingView's free widgetembed iframe URL.
 *
 * Desk-owned `range` drives `interval`. We keep `withdateranges` off so the
 * iframe bottom chips cannot diverge from the performance % we compute.
 */
export function buildTradingViewEmbedUrl(
  symbol: string,
  options?: { fullscreen?: boolean; range?: ChartRangeKey },
): string {
  const fullscreen = Boolean(options?.fullscreen);
  const range = options?.range ?? DEFAULT_CHART_RANGE;
  const interval = chartRangeDef(range).interval;
  const params = new URLSearchParams({
    symbol: symbol.trim(),
    interval,
    theme: "dark",
    style: DEFAULT_CHART_STYLE,
    locale: "en",
    timezone: "America/New_York",
    withdateranges: "0",
    hidesidetoolbar: fullscreen ? "0" : "1",
    hidetoptoolbar: "0",
    symboledit: "0",
    saveimage: "0",
    toolbarbg: "0f1115",
    hideideas: "1",
    hidelegend: "1",
    studies: "[]",
  });
  return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
}

/**
 * TradingView chart for the Live tape split panel.
 * Uses the widgetembed iframe (no broken tv.js dependency).
 */
export function TradingViewAdvancedChart({
  symbol,
  className,
  allowFullscreen = true,
  range = DEFAULT_CHART_RANGE,
  onRangeChange,
}: {
  symbol: string;
  className?: string;
  allowFullscreen?: boolean;
  range?: ChartRangeKey;
  onRangeChange?: (range: ChartRangeKey) => void;
}) {
  const trimmed = symbol.trim();
  const [fullscreen, setFullscreen] = useState(false);
  const src = useMemo(
    () => (trimmed ? buildTradingViewEmbedUrl(trimmed, { range }) : null),
    [trimmed, range],
  );
  const fullSrc = useMemo(
    () =>
      trimmed
        ? buildTradingViewEmbedUrl(trimmed, { fullscreen: true, range })
        : null,
    [trimmed, range],
  );

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  if (!src) {
    return (
      <div
        className={cn(
          "grid min-h-[220px] w-full place-items-center overflow-hidden",
          className,
        )}
      >
        <p className="px-4 text-center font-mono text-xs text-[var(--desk-text-muted)]">
          Chart unavailable
        </p>
      </div>
    );
  }

  const rangeChips = onRangeChange ? (
    <div
      className="flex flex-wrap items-center gap-1 border-b border-[var(--desk-border)] bg-[var(--desk-header)] px-2 py-1.5"
      role="group"
      aria-label="Chart time range"
    >
      {CHART_RANGES.map((r) => {
        const active = r.key === range;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onRangeChange(r.key)}
            aria-pressed={active}
            className={cn(
              "rounded-sm px-2 py-0.5 font-mono text-[0.65rem] tracking-wide uppercase transition-colors",
              active
                ? "bg-[var(--desk-live)]/15 text-[var(--desk-live)]"
                : "text-[var(--desk-text-muted)] hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]",
            )}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <>
      <div
        className={cn(
          "relative flex min-h-[220px] w-full flex-col overflow-hidden",
          className,
        )}
        data-tv-symbol={trimmed}
        data-tv-range={range}
      >
        {rangeChips}
        <div className="relative min-h-0 flex-1">
          {allowFullscreen ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFullscreen(true);
              }}
              className="absolute top-2 right-2 z-10 inline-flex items-center gap-1.5 rounded-sm border border-[var(--desk-border-strong)] bg-[var(--desk-panel)]/90 px-2 py-1 font-mono text-[0.65rem] tracking-wide text-[var(--desk-text-secondary)] uppercase shadow-md backdrop-blur-sm transition-colors hover:border-[var(--desk-text-dim)] hover:text-[var(--desk-text)]"
              title="Open chart full screen"
            >
              <Maximize2 className="size-3" />
              Full
            </button>
          ) : null}
          <iframe
            key={`${trimmed}-${range}`}
            title={`${trimmed} chart`}
            src={src}
            className="h-full w-full border-0"
            style={{ minHeight: 220 }}
            loading="lazy"
            referrerPolicy="origin-when-cross-origin"
            allow="fullscreen; clipboard-write"
          />
        </div>
      </div>

      {fullscreen && fullSrc ? (
        <div
          className="fixed inset-0 z-[90] flex flex-col bg-black/70 p-3 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label={`${trimmed} chart full screen`}
          onClick={() => setFullscreen(false)}
        >
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--desk-border-strong)] bg-[var(--desk-panel)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--desk-border)] bg-[var(--desk-header)] px-4 py-2.5">
              <p className="font-mono text-sm font-semibold tracking-wide text-[var(--desk-live)]">
                {trimmed}
                <span className="ml-2 font-normal tracking-[0.12em] text-[var(--desk-text-dim)] uppercase">
                  Chart
                </span>
              </p>
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--desk-border-strong)] px-2.5 py-1 font-mono text-[0.68rem] tracking-wide text-[var(--desk-text-muted)] uppercase transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
              >
                <Minimize2 className="size-3.5" />
                Exit
                <X className="size-3.5 opacity-70" />
              </button>
            </div>
            {onRangeChange ? (
              <div
                className="flex flex-wrap items-center gap-1 border-b border-[var(--desk-border)] bg-[var(--desk-header)] px-3 py-1.5"
                role="group"
                aria-label="Chart time range"
              >
                {CHART_RANGES.map((r) => {
                  const active = r.key === range;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => onRangeChange(r.key)}
                      aria-pressed={active}
                      className={cn(
                        "rounded-sm px-2 py-0.5 font-mono text-[0.65rem] tracking-wide uppercase transition-colors",
                        active
                          ? "bg-[var(--desk-live)]/15 text-[var(--desk-live)]"
                          : "text-[var(--desk-text-muted)] hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]",
                      )}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className="min-h-0 flex-1 bg-[#0b0d10]">
              <iframe
                key={`full-${trimmed}-${range}`}
                title={`${trimmed} chart full screen`}
                src={fullSrc}
                className="h-full w-full border-0"
                referrerPolicy="origin-when-cross-origin"
                allow="fullscreen; clipboard-write"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
