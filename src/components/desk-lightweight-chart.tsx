"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { Maximize2, Minimize2, X } from "lucide-react";

import {
  CHART_RANGES,
  DEFAULT_CHART_RANGE,
  type ChartRangeKey,
} from "@/lib/market/chart-range";
import type { DeskCandle } from "@/lib/market/fetch-candles";
import { cn } from "@/lib/utils";

type CandlesPayload = {
  symbol: string;
  range: ChartRangeKey;
  provider: "finnhub" | "polygon" | "demo";
  candles: DeskCandle[];
};

function toUtc(time: number): UTCTimestamp {
  return time as UTCTimestamp;
}

/**
 * Professional blotter chart for the article / Live tape split panel.
 * Built on TradingView Lightweight Charts
 * (https://github.com/tradingview/lightweight-charts):
 * - 1D → area line (fast scan)
 * - longer ranges → candles
 * - optional vertical catalyst marker when `eventTimeSec` is set
 */
export function DeskLightweightChart({
  symbol,
  className,
  allowFullscreen = true,
  range = DEFAULT_CHART_RANGE,
  onRangeChange,
  eventTimeSec = null,
}: {
  symbol: string;
  className?: string;
  allowFullscreen?: boolean;
  range?: ChartRangeKey;
  onRangeChange?: (range: ChartRangeKey) => void;
  /** Catalyst timestamp (unix seconds) — draws an event marker when in range. */
  eventTimeSec?: number | null;
}) {
  const trimmed = symbol.trim().toUpperCase();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const fullHostRef = useRef<HTMLDivElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [payload, setPayload] = useState<CandlesPayload | null>(null);
  const [loading, setLoading] = useState(Boolean(trimmed));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!trimmed) return;

    let cancelled = false;
    // Defer setState so we don't trip react-hooks/set-state-in-effect.
    const id = window.setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      void (async () => {
        try {
          const res = await fetch(
            `/api/market/candles?symbol=${encodeURIComponent(trimmed)}&range=${encodeURIComponent(range)}`,
          );
          if (!res.ok) {
            throw new Error(`Chart data unavailable (${res.status})`);
          }
          const json = (await res.json()) as CandlesPayload;
          if (!cancelled) setPayload(json);
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Chart failed");
            setPayload(null);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [trimmed, range]);

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

  useChartPane({
    hostRef,
    payload,
    eventTimeSec,
    active: Boolean(payload?.candles.length),
  });

  useChartPane({
    hostRef: fullHostRef,
    payload,
    eventTimeSec,
    active: fullscreen && Boolean(payload?.candles.length),
  });

  if (!trimmed) {
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

  const last = payload?.candles[payload.candles.length - 1];
  const first = payload?.candles[0];
  const change = last && first ? last.close - first.open : null;
  const changePct =
    change != null && first && first.open !== 0
      ? (change / first.open) * 100
      : null;
  const up = change == null ? null : change === 0 ? null : change > 0;

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
                ? "bg-[var(--desk-link)]/15 text-[var(--desk-link)]"
                : "text-[var(--desk-text-muted)] hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]",
            )}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  ) : null;

  const header = (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--desk-border)] bg-[var(--desk-panel)] px-3 py-2">
      <div className="min-w-0">
        <p className="font-mono text-[0.62rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
          Price · {trimmed} · {range}
          {payload?.provider === "demo" ? (
            <span className="ml-2 text-[var(--desk-warn)]">Demo series</span>
          ) : null}
        </p>
        <p className="mt-0.5 flex flex-wrap items-baseline gap-2 font-mono">
          <span className="text-base font-semibold text-[var(--desk-text)] tabular-nums">
            {last ? last.close.toFixed(2) : loading ? "…" : "—"}
          </span>
          {change != null && changePct != null ? (
            <span
              className={cn(
                "text-xs tabular-nums",
                up === true && "text-[var(--desk-positive)]",
                up === false && "text-[var(--desk-negative)]",
                up == null && "text-[var(--desk-text-muted)]",
              )}
            >
              {change > 0 ? "+" : ""}
              {change.toFixed(2)} ({changePct > 0 ? "+" : ""}
              {changePct.toFixed(2)}%)
            </span>
          ) : null}
        </p>
      </div>
      {allowFullscreen ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setFullscreen(true);
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-[var(--desk-border-strong)] bg-[var(--desk-panel)] px-2 py-1 font-mono text-[0.65rem] tracking-wide text-[var(--desk-text-secondary)] uppercase transition-colors hover:border-[var(--desk-text-dim)] hover:text-[var(--desk-text)]"
          title="Open chart full screen"
        >
          <Maximize2 className="size-3" />
          Full
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <div
        className={cn(
          "relative flex min-h-[220px] w-full flex-col overflow-hidden bg-[var(--desk-bg,#0b0f19)]",
          className,
        )}
        data-lw-symbol={trimmed}
        data-lw-range={range}
      >
        {header}
        {rangeChips}
        <div className="relative min-h-0 flex-1">
          {loading ? (
            <p className="absolute inset-0 grid place-items-center font-mono text-xs text-[var(--desk-text-muted)]">
              Loading chart…
            </p>
          ) : null}
          {error && !payload ? (
            <p className="absolute inset-0 grid place-items-center px-4 text-center font-mono text-xs text-[var(--desk-negative)]">
              {error}
            </p>
          ) : null}
          <div ref={hostRef} className="h-full min-h-[200px] w-full" />
        </div>
      </div>

      {fullscreen ? (
        <div
          className="fixed inset-0 z-[90] flex flex-col bg-black/70 p-3 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label={`${trimmed} chart full screen`}
          onClick={() => setFullscreen(false)}
        >
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--desk-border-strong)] bg-[var(--desk-bg,#0b0f19)] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--desk-border)] bg-[var(--desk-header)] px-4 py-2.5">
              <p className="font-mono text-sm font-semibold tracking-wide text-[var(--desk-text)]">
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
                  const activeChip = r.key === range;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => onRangeChange(r.key)}
                      aria-pressed={activeChip}
                      className={cn(
                        "rounded-sm px-2 py-0.5 font-mono text-[0.65rem] tracking-wide uppercase transition-colors",
                        activeChip
                          ? "bg-[var(--desk-link)]/15 text-[var(--desk-link)]"
                          : "text-[var(--desk-text-muted)] hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]",
                      )}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div ref={fullHostRef} className="min-h-0 flex-1" />
          </div>
        </div>
      ) : null}
    </>
  );
}

function useChartPane({
  hostRef,
  payload,
  eventTimeSec,
  active,
}: {
  hostRef: RefObject<HTMLDivElement | null>;
  payload: CandlesPayload | null;
  eventTimeSec: number | null;
  active: boolean;
}) {
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!active || !el || !payload || payload.candles.length === 0) {
      return;
    }

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#0B0F19" },
        textColor: "#94A3B8",
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.08)" },
        horzLines: { color: "rgba(148,163,184,0.08)" },
      },
      rightPriceScale: {
        borderColor: "rgba(148,163,184,0.18)",
      },
      timeScale: {
        borderColor: "rgba(148,163,184,0.18)",
        timeVisible: payload.range === "1D" || payload.range === "5D",
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { color: "rgba(59,130,246,0.45)", width: 1 },
        horzLine: { color: "rgba(59,130,246,0.45)", width: 1 },
      },
    });
    chartRef.current = chart;

    const useCandles = payload.range !== "1D";
    let series: ISeriesApi<"Candlestick"> | ISeriesApi<"Area">;

    if (useCandles) {
      series = chart.addSeries(CandlestickSeries, {
        upColor: "#22C55E",
        downColor: "#EF4444",
        borderUpColor: "#22C55E",
        borderDownColor: "#EF4444",
        wickUpColor: "#22C55E",
        wickDownColor: "#EF4444",
      });
      series.setData(
        payload.candles.map((c) => ({
          time: toUtc(c.time),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );
    } else {
      series = chart.addSeries(AreaSeries, {
        lineColor: "#3B82F6",
        topColor: "rgba(59,130,246,0.28)",
        bottomColor: "rgba(59,130,246,0.02)",
        lineWidth: 2,
      });
      series.setData(
        payload.candles.map((c) => ({
          time: toUtc(c.time),
          value: c.close,
        })),
      );
    }

    if (eventTimeSec != null && Number.isFinite(eventTimeSec)) {
      const times = payload.candles.map((c) => c.time);
      const minT = times[0]!;
      const maxT = times[times.length - 1]!;
      if (eventTimeSec >= minT && eventTimeSec <= maxT) {
        // Snap marker to nearest bar time (Lightweight Charts requires bar time).
        let nearest = times[0]!;
        let best = Math.abs(times[0]! - eventTimeSec);
        for (const t of times) {
          const d = Math.abs(t - eventTimeSec);
          if (d < best) {
            best = d;
            nearest = t;
          }
        }
        createSeriesMarkers(series, [
          {
            time: toUtc(nearest),
            position: "aboveBar",
            color: "#F59E0B",
            shape: "arrowDown",
            text: "EVENT",
          },
        ]);
      }
    }

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [active, payload, eventTimeSec, hostRef]);
}
