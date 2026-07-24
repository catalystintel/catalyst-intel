"use client";

import { useEffect, useId, useRef } from "react";

import { cn } from "@/lib/utils";

declare global {
  interface Window {
    TradingView?: {
      widget: new (options: Record<string, unknown>) => unknown;
    };
  }
}

const TV_SCRIPT_SRC = "https://s.tradingview.com/tv.js";

let scriptPromise: Promise<void> | null = null;

function loadTradingViewScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.TradingView?.widget) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TV_SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("TradingView script failed to load")),
        { once: true },
      );
      if (window.TradingView?.widget) resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = TV_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("TradingView script failed to load"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * TradingView Advanced Chart embed — ranges, crosshair, and hover values
 * come from TradingView (best accuracy vs DIY candles).
 */
export function TradingViewAdvancedChart({
  symbol,
  className,
}: {
  symbol: string;
  className?: string;
}) {
  const reactId = useId().replace(/:/g, "");
  const containerId = `tv_chart_${reactId}`;
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !symbol.trim()) return;

    let cancelled = false;

    void (async () => {
      try {
        await loadTradingViewScript();
        if (cancelled || !window.TradingView?.widget) return;

        host.innerHTML = "";
        const mount = document.createElement("div");
        mount.id = containerId;
        mount.style.width = "100%";
        mount.style.height = "100%";
        host.appendChild(mount);

        // TradingView mutates the container; recreate on symbol change.
        new window.TradingView.widget({
          autosize: true,
          symbol: symbol.trim(),
          interval: "D",
          timezone: "America/New_York",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#0f1115",
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          container_id: containerId,
          withdateranges: true,
          hide_side_toolbar: true,
          allow_symbol_change: false,
          details: false,
          hotlist: false,
          calendar: false,
          support_host: "https://www.tradingview.com",
        });
      } catch {
        if (!cancelled && host) {
          host.innerHTML =
            '<p class="grid h-full place-items-center px-4 text-center font-mono text-xs text-[var(--desk-text-muted)]">Chart unavailable</p>';
        }
      }
    })();

    return () => {
      cancelled = true;
      if (host) host.innerHTML = "";
    };
  }, [symbol, containerId]);

  return (
    <div
      ref={hostRef}
      className={cn("min-h-[220px] w-full overflow-hidden", className)}
      data-tv-symbol={symbol}
    />
  );
}
