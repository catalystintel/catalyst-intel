"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, X } from "lucide-react";

import { FeedPreviewChartGlow } from "@/components/feed-preview-chart-glow";
import { getSignInStartHref } from "@/lib/auth/dev-bypass";
import { cn } from "@/lib/utils";

/**
 * Matches live blotter: Symbol · Title · Time (+ Actions). The `lg` actions
 * track is narrow (one stacked-button width, not two side by side) so the
 * dense desktop grid still fits once the hero sits beside the feed preview
 * card instead of spanning the full page width.
 */
const PREVIEW_GRID =
  "grid-cols-[4.5rem_minmax(0,1fr)] sm:grid-cols-[5rem_minmax(0,1fr)_156px] lg:grid-cols-[5rem_minmax(0,1fr)_160px_minmax(84px,max-content)]";

const VISIBLE_ROWS = 6;
const STREAM_INTERVAL_MS = 4000;

type DemoRow = {
  symbol: string;
  title: string;
  category: string;
  /** Amber chip = high-priority catalyst class (halts, FDA) — never color alone. */
  highPriority?: boolean;
  time: string;
  timeShort: string;
};

/**
 * Believable trader-oriented demo tape. Titles follow the product's
 * catalyst-title tone; categories match the real event taxonomy.
 * Pool is larger than the visible window so approach A can stream inserts.
 */
const DEMO_POOL: DemoRow[] = [
  {
    symbol: "NVDA",
    title: "NVIDIA Corp - Earnings Report Q3",
    category: "Earnings",
    time: "9:42 AM · Jul 26, 2026",
    timeShort: "9:42 AM",
  },
  {
    symbol: "MRK",
    title: "Merck & Co. Receives FDA Approval",
    category: "FDA",
    highPriority: true,
    time: "9:36 AM · Jul 26, 2026",
    timeShort: "9:36 AM",
  },
  {
    symbol: "AMD",
    title: "AMD - New Deal Announced (Major Contract or Partnership)",
    category: "M&A",
    time: "9:31 AM · Jul 26, 2026",
    timeShort: "9:31 AM",
  },
  {
    symbol: "IONS",
    title: "Halts (Ionis Pharmaceuticals) - News Pending",
    category: "Halt",
    highPriority: true,
    time: "9:27 AM · Jul 26, 2026",
    timeShort: "9:27 AM",
  },
  {
    symbol: "JPM",
    title: "JPMorgan Chase - CFO Change (Departure)",
    category: "Mgmt",
    time: "9:20 AM · Jul 26, 2026",
    timeShort: "9:20 AM",
  },
  {
    symbol: "—",
    title: "CPI — June 2026",
    category: "Macro",
    time: "8:30 AM · Jul 26, 2026",
    timeShort: "8:30 AM",
  },
  {
    symbol: "TSLA",
    title: "Tesla Inc - 8-K Item 2.02 Results of Operations",
    category: "Earnings",
    time: "9:48 AM · Jul 26, 2026",
    timeShort: "9:48 AM",
  },
  {
    symbol: "LLY",
    title: "Eli Lilly - Phase 3 Trial Meets Primary Endpoint",
    category: "Clinical",
    highPriority: true,
    time: "9:51 AM · Jul 26, 2026",
    timeShort: "9:51 AM",
  },
  {
    symbol: "AAPL",
    title: "Apple Inc - Form 4 Insider Sale (10b5-1)",
    category: "Insider",
    time: "9:55 AM · Jul 26, 2026",
    timeShort: "9:55 AM",
  },
  {
    symbol: "BA",
    title: "Boeing Co - Analyst Upgrade (Overweight)",
    category: "Analyst",
    time: "10:02 AM · Jul 26, 2026",
    timeShort: "10:02 AM",
  },
  {
    symbol: "SMCI",
    title: "Super Micro Computer - Offering / Dilution Filed",
    category: "Capital",
    highPriority: true,
    time: "10:08 AM · Jul 26, 2026",
    timeShort: "10:08 AM",
  },
  {
    symbol: "XOM",
    title: "Exxon Mobil - Asset Sale / Divestiture Announced",
    category: "M&A",
    time: "10:14 AM · Jul 26, 2026",
    timeShort: "10:14 AM",
  },
  {
    symbol: "PFE",
    title: "Pfizer Inc - FDA CRL / Complete Response Letter",
    category: "FDA",
    highPriority: true,
    time: "10:19 AM · Jul 26, 2026",
    timeShort: "10:19 AM",
  },
  {
    symbol: "META",
    title: "Meta Platforms - Guidance Raised (FY)",
    category: "Earnings",
    time: "10:25 AM · Jul 26, 2026",
    timeShort: "10:25 AM",
  },
  {
    symbol: "GME",
    title: "Halts (GameStop) - Volatility Pause",
    category: "Halt",
    highPriority: true,
    time: "10:31 AM · Jul 26, 2026",
    timeShort: "10:31 AM",
  },
  {
    symbol: "—",
    title: "FOMC Rate Decision — July 2026",
    category: "Macro",
    time: "2:00 PM · Jul 26, 2026",
    timeShort: "2:00 PM",
  },
];

type VisibleRow = DemoRow & { key: string };

function CategoryChip({
  children,
  highPriority = false,
}: {
  children: ReactNode;
  highPriority?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm border px-1.5 py-px font-mono text-[0.6rem] font-semibold tracking-[0.08em] uppercase",
        highPriority
          ? "border-[color-mix(in_srgb,var(--desk-live)_40%,transparent)] bg-[color-mix(in_srgb,var(--desk-live)_12%,transparent)] text-[var(--desk-live)]"
          : "border-[var(--desk-border-strong)] text-[var(--desk-text-muted)]",
      )}
    >
      {children}
    </span>
  );
}

function PreviewActionChip({
  children,
  variant = "ghost",
}: {
  children: ReactNode;
  variant?: "primary" | "ghost";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 font-mono text-[0.65rem] font-semibold tracking-wide uppercase",
        variant === "primary"
          ? "bg-[var(--landing-primary,#00d4aa)] text-[var(--desk-accent-fg,#131722)]"
          : "border border-[var(--desk-border-strong)] text-[var(--desk-text-muted)]",
      )}
    >
      {children}
    </span>
  );
}

function DemoFeedRow({
  row,
  animateIn,
}: {
  row: VisibleRow;
  animateIn: boolean;
}) {
  return (
    <article
      role="row"
      className={cn(
        "feed-row grid min-h-[56px] items-center gap-2 border-b border-[var(--desk-border)] px-4 py-3 last:border-b-0 sm:gap-3 sm:px-5 sm:py-0",
        animateIn && "row-flash",
        PREVIEW_GRID,
      )}
    >
      <div role="cell" className="min-w-0">
        <span className="desk-data truncate font-bold tracking-tight text-[var(--desk-text)]">
          {row.symbol}
        </span>
      </div>

      <div role="cell" className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden md:inline-flex">
            <CategoryChip highPriority={row.highPriority}>
              {row.category}
            </CategoryChip>
          </span>
          <span className="feed-article-title line-clamp-2 min-w-0 text-[var(--desk-text-secondary)] sm:line-clamp-1">
            {row.title}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2 md:hidden">
          <CategoryChip highPriority={row.highPriority}>
            {row.category}
          </CategoryChip>
          <time className="desk-data font-medium tracking-tight whitespace-nowrap text-[var(--desk-text-muted)] sm:hidden">
            {row.timeShort}
          </time>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 lg:hidden">
          <PreviewActionChip variant="primary">
            <BookOpen className="size-3" />
            Details
          </PreviewActionChip>
          <PreviewActionChip>
            <X className="size-3" />
            Dismiss
          </PreviewActionChip>
        </div>
      </div>

      <div role="cell" className="hidden min-w-0 text-right sm:block">
        <time className="desk-data inline-block max-w-full font-medium tracking-tight whitespace-nowrap text-[var(--desk-text-dim)]">
          {row.time}
        </time>
      </div>

      <div role="cell" className="hidden min-w-0 justify-end lg:flex">
        <div className="flex w-full min-w-0 flex-col items-end justify-center gap-1">
          <PreviewActionChip variant="primary">
            <BookOpen className="size-3" />
            Details
          </PreviewActionChip>
          <PreviewActionChip>
            <X className="size-3" />
            Dismiss
          </PreviewActionChip>
        </div>
      </div>
    </article>
  );
}

/**
 * Hero blotter preview: fixed visible row count with approach A streaming —
 * every few seconds insert a new demo article at the top and drop the oldest.
 * Pauses for `prefers-reduced-motion` and when the document is hidden.
 */
export function LandingHeroFeedPreview() {
  const idPrefix = useId();
  const [rows, setRows] = useState<VisibleRow[]>(() =>
    DEMO_POOL.slice(0, VISIBLE_ROWS).map((row, i) => ({
      ...row,
      key: `${idPrefix}-init-${i}`,
    })),
  );
  const [latestKey, setLatestKey] = useState<string | null>(null);
  const nextPoolIndexRef = useRef(VISIBLE_ROWS);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) return;

    let seq = 0;
    const tick = () => {
      if (document.hidden) return;
      seq += 1;
      const poolIndex = nextPoolIndexRef.current;
      const incoming = DEMO_POOL[poolIndex % DEMO_POOL.length]!;
      nextPoolIndexRef.current = poolIndex + 1;
      const key = `${idPrefix}-stream-${seq}`;
      setLatestKey(key);
      setRows((prev) => [
        { ...incoming, key },
        ...prev.slice(0, VISIBLE_ROWS - 1),
      ]);
    };

    const intervalId = window.setInterval(tick, STREAM_INTERVAL_MS);
    const onMotionChange = () => {
      if (motionQuery.matches) window.clearInterval(intervalId);
    };
    motionQuery.addEventListener("change", onMotionChange);
    return () => {
      window.clearInterval(intervalId);
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, [idPrefix]);

  return (
    <section
      aria-label="Feed preview"
      className="landing-feed landing-feed-dark signal-glass relative overflow-hidden rounded-lg shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,212,170,0.12)]"
    >
      <FeedPreviewChartGlow />

      <div className="relative z-[1] flex items-center justify-between border-b border-[var(--desk-border)] bg-[color:var(--desk-header)]/85 px-4 py-3 backdrop-blur-[1px] sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--desk-live-status)_35%,transparent)] bg-[color-mix(in_srgb,var(--desk-live-status)_12%,transparent)] px-2.5 py-1 text-[0.68rem] font-bold tracking-[0.08em] text-[var(--desk-live-status)]">
            <span
              aria-hidden
              className="live-pulse size-1.5 rounded-full bg-[var(--desk-live-status)]"
            />
            LIVE
          </span>
          <span className="truncate text-[0.86rem] font-semibold text-[var(--desk-text)]">
            Catalyst Feed
          </span>
        </div>
        <span className="font-mono text-[0.72rem] tracking-[0.08em] text-[var(--desk-text-dim)] uppercase">
          Preview
        </span>
      </div>

      <div role="table" aria-label="Blotter preview" className="flex flex-col">
        <div
          role="row"
          className={cn(
            "desk-caps grid h-10 items-center gap-2 border-b border-[var(--desk-border-strong)] bg-[var(--desk-header)] px-4 font-mono text-[0.62rem] font-medium text-[var(--desk-text-dim)] uppercase shadow-[0_1px_0_rgba(0,0,0,0.35)] sm:gap-3 sm:px-5",
            PREVIEW_GRID,
          )}
        >
          <div role="columnheader" className="min-w-0">
            Symbol
          </div>
          <div role="columnheader" className="min-w-0">
            Event
          </div>
          <div
            role="columnheader"
            className="hidden text-right sm:block"
            title="When the event occurred (your local time)"
          >
            Time
          </div>
          <div role="columnheader" className="hidden text-right lg:block">
            Actions
          </div>
        </div>

        {rows.map((row) => (
          <DemoFeedRow
            key={row.key}
            row={row}
            animateIn={row.key === latestKey}
          />
        ))}
      </div>

      <div className="relative z-[1] flex items-center justify-between border-t border-[var(--desk-border)] bg-[color:var(--desk-header)]/85 px-4 py-2.5 backdrop-blur-[1px] sm:px-5">
        <span className="inline-flex items-center gap-1.5 font-mono text-[0.68rem] font-medium tracking-[0.04em] text-[var(--desk-text-dim)]">
          <span
            aria-hidden
            className="live-pulse size-1.5 rounded-full bg-[var(--desk-live-status)]"
          />
          Live updates · Auto-refreshing
        </span>
        <Link
          href={getSignInStartHref()}
          className="inline-flex shrink-0 items-center gap-1 font-mono text-[0.68rem] font-semibold text-[var(--desk-text-secondary)] underline-offset-4 transition-colors hover:text-[var(--desk-text)] hover:underline"
        >
          View full feed
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
