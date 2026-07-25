"use client";

import { useEffect, useMemo, useState } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";

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
 * The legacy `https://s.tradingview.com/tv.js` Advanced Chart loader now
 * 301s to `www.tradingview.com/tv.js` (404 HTML), so `TradingView.widget`
 * never exists and every chart rendered "Chart unavailable".
 */
export function buildTradingViewEmbedUrl(
  symbol: string,
  options?: { fullscreen?: boolean },
): string {
  const fullscreen = Boolean(options?.fullscreen);
  const params = new URLSearchParams({
    symbol: symbol.trim(),
    interval: "D",
    theme: "dark",
    style: DEFAULT_CHART_STYLE,
    locale: "en",
    timezone: "America/New_York",
    withdateranges: "1",
    hidesidetoolbar: fullscreen ? "0" : "1",
    hidetoptoolbar: "0",
    symboledit: "0",
    saveimage: "0",
    toolbarbg: "0f1115",
    hideideas: "1",
    studies: "[]",
  });
  return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
}

/**
 * TradingView chart for the Live tape split panel.
 * Uses the widgetembed iframe (no broken tv.js dependency).
 * Optional expand control opens a near-fullscreen desk overlay.
 */
export function TradingViewAdvancedChart({
  symbol,
  className,
  allowFullscreen = true,
}: {
  symbol: string;
  className?: string;
  /** Show expand control for full-mode chart. */
  allowFullscreen?: boolean;
}) {
  const trimmed = symbol.trim();
  const [fullscreen, setFullscreen] = useState(false);
  const src = useMemo(
    () => (trimmed ? buildTradingViewEmbedUrl(trimmed) : null),
    [trimmed],
  );
  const fullSrc = useMemo(
    () =>
      trimmed ? buildTradingViewEmbedUrl(trimmed, { fullscreen: true }) : null,
    [trimmed],
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

  return (
    <>
      <div
        className={cn(
          "relative min-h-[220px] w-full overflow-hidden",
          className,
        )}
        data-tv-symbol={trimmed}
      >
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
          title={`${trimmed} chart`}
          src={src}
          className="h-full w-full border-0"
          style={{ minHeight: 220 }}
          loading="lazy"
          referrerPolicy="origin-when-cross-origin"
          allow="fullscreen; clipboard-write"
        />
      </div>

      {fullscreen && fullSrc ? (
        <div
          className="fixed inset-0 z-[90] flex flex-col bg-black/70 p-3 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label={`${trimmed} chart full screen`}
          onClick={() => setFullscreen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setFullscreen(false);
          }}
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
            <div className="min-h-0 flex-1 bg-[#0b0d10]">
              <iframe
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
