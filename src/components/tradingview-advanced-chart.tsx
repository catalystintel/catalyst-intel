"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";

/**
 * Build TradingView's free widgetembed iframe URL.
 *
 * The legacy `https://s.tradingview.com/tv.js` Advanced Chart loader now
 * 301s to `www.tradingview.com/tv.js` (404 HTML), so `TradingView.widget`
 * never exists and every chart rendered "Chart unavailable".
 */
export function buildTradingViewEmbedUrl(symbol: string): string {
  const params = new URLSearchParams({
    symbol: symbol.trim(),
    interval: "D",
    theme: "dark",
    style: "1",
    locale: "en",
    timezone: "America/New_York",
    withdateranges: "1",
    hidesidetoolbar: "1",
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
 */
export function TradingViewAdvancedChart({
  symbol,
  className,
}: {
  symbol: string;
  className?: string;
}) {
  const trimmed = symbol.trim();
  const src = useMemo(
    () => (trimmed ? buildTradingViewEmbedUrl(trimmed) : null),
    [trimmed],
  );

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
    <div
      className={cn("min-h-[220px] w-full overflow-hidden", className)}
      data-tv-symbol={trimmed}
    >
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
  );
}
