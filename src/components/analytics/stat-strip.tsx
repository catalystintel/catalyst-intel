"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface Stat {
  label: string;
  value: number;
  suffix?: string;
  accent?: boolean;
}

/**
 * Compact glance stats for the analytics window (catalyst count + active
 * tickers).
 */
export function StatStrip({
  totalCount,
  activeTickerCount,
}: {
  totalCount: number;
  activeTickerCount: number;
}) {
  const stats: Stat[] = [
    { label: "Catalysts", value: totalCount },
    { label: "Active tickers", value: activeTickerCount },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}

function StatCard({ label, value, suffix, accent }: Stat) {
  const display = useCountUp(value);
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)] px-4 py-3.5">
      <p className="font-mono text-[0.65rem] tracking-[0.12em] text-[var(--desk-text-dim)] uppercase">
        {label}
      </p>
      <p
        className={cn(
          "font-mono text-2xl font-semibold tracking-tight tabular-nums",
          accent && value > 0
            ? "text-[var(--desk-live)]"
            : "text-[var(--desk-text)]",
        )}
      >
        {display}
        {suffix ? (
          <span className="ml-0.5 text-sm font-normal text-[var(--desk-text-dim)]">
            {suffix}
          </span>
        ) : null}
      </p>
    </div>
  );
}

/**
 * Eases a stat's displayed number toward its real value over ~500ms instead
 * of snapping, so switching the window selector (or a background refresh)
 * feels like the numbers are "counting" rather than just replacing text.
 */
function useCountUp(target: number, durationMs = 500): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return display;
}
