import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, X } from "lucide-react";

import { FeedPreviewChartGlow } from "@/components/feed-preview-chart-glow";
import { PreLoginChrome } from "@/components/pre-login-chrome";
import { PreLoginLandingSections } from "@/components/pre-login-landing-sections";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Matches live blotter: Symbol · Title · Time (+ Actions). */
const PREVIEW_GRID =
  "grid-cols-[4.5rem_minmax(0,1fr)] sm:grid-cols-[5rem_minmax(0,1fr)_156px] lg:grid-cols-[5rem_minmax(0,1fr)_160px_minmax(200px,max-content)]";

/**
 * Demo rows mirror real tape output: titles follow the product's
 * catalyst-title generators (see src/lib/catalysts/catalyst-titles.ts) and
 * categories come from the real event taxonomy — believable, not decorative.
 */
const DEMO_ROWS: {
  symbol: string;
  title: string;
  category: string;
  /** Gold chip = high-priority catalyst class (halts, FDA) — never color alone. */
  highPriority?: boolean;
  time: string;
  timeShort: string;
}[] = [
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
];

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
          ? "border-[rgba(240,193,75,0.4)] bg-[rgba(240,193,75,0.12)] text-[var(--desk-live)]"
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
          ? "bg-[var(--desk-live)] text-[#121212]"
          : "border border-[var(--desk-border-strong)] text-[var(--desk-text-muted)]",
      )}
    >
      {children}
    </span>
  );
}

export default async function Home() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect("/catalyst-feed");
    }
  }

  return (
    <PreLoginChrome glowClassName="h-[55vh]">
      <main className="page-enter relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-start gap-10 px-4 pt-2 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:gap-12 sm:px-8 sm:pt-6 sm:pb-20">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(240,193,75,0.35)] bg-[rgba(240,193,75,0.12)] px-2.5 py-1 text-[0.68rem] font-bold tracking-[0.08em] text-[var(--desk-live)]">
              <span
                aria-hidden
                className="live-pulse size-1.5 rounded-full bg-[var(--desk-live)]"
              />
              LIVE
            </span>
            <span className="inline-flex items-center rounded-full border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2.5 py-1 font-mono text-[0.68rem] font-semibold tracking-[0.08em] text-[var(--desk-text-secondary)] uppercase">
              Open Early Access · Free
            </span>
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-balance text-[var(--desk-text)] sm:text-5xl">
            Catalyst Intel
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-pretty text-[var(--desk-text-secondary)] sm:text-lg">
            The catalysts that move stocks — earnings, SEC filings, FDA
            decisions, trading halts — on one live tape, translated into plain
            English.
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-pretty text-[var(--desk-text-muted)] sm:text-base">
            Scan symbol, title, and time. Open a row for the facts that matter.
            During Open Early Access every feature is free — no card required.
          </p>
          <div className="mt-8">
            <Link
              href="/login"
              className="inline-flex items-center font-mono text-xs font-semibold text-[var(--desk-live)] underline-offset-4 hover:underline"
            >
              Sign in · no password · full access
            </Link>
          </div>
        </div>

        <section
          aria-label="Feed preview"
          className="landing-feed landing-feed-dark relative overflow-hidden rounded-lg border border-[var(--desk-border)] bg-[var(--desk-panel)] shadow-[0_24px_80px_rgba(10,12,20,0.35)]"
        >
          <FeedPreviewChartGlow />

          <div className="relative z-[1] flex items-center justify-between border-b border-[var(--desk-border)] bg-[color:var(--desk-header)]/85 px-4 py-3 backdrop-blur-[1px] sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(240,193,75,0.35)] bg-[rgba(240,193,75,0.12)] px-2.5 py-1 text-[0.68rem] font-bold tracking-[0.08em] text-[var(--desk-live)]">
                <span
                  aria-hidden
                  className="live-pulse size-1.5 rounded-full bg-[var(--desk-live)]"
                />
                LIVE
              </span>
              <span className="truncate text-[0.86rem] text-[var(--desk-text-muted)]">
                Catalyst Feed preview
              </span>
            </div>
            <span className="font-mono text-[0.72rem] tracking-[0.08em] text-[var(--desk-text-dim)] uppercase">
              Preview
            </span>
          </div>

          <div
            role="table"
            aria-label="Blotter preview"
            className="flex flex-col"
          >
            <div
              role="row"
              className={cn(
                "grid h-10 items-center gap-2 border-b border-[var(--desk-border-strong)] bg-[var(--desk-header)] px-4 font-mono text-[0.62rem] font-medium tracking-[0.12em] text-[var(--desk-text-dim)] uppercase shadow-[0_1px_0_rgba(0,0,0,0.35)] sm:gap-3 sm:px-5",
                PREVIEW_GRID,
              )}
            >
              <div role="columnheader" className="min-w-0">
                Symbol
              </div>
              <div role="columnheader" className="min-w-0">
                Title
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

            {DEMO_ROWS.map((row, index) => (
              <article
                key={`${row.symbol}-${row.timeShort}`}
                role="row"
                className={cn(
                  "feed-row grid min-h-[56px] items-center gap-2 border-b border-[var(--desk-border)] px-4 py-3 last:border-b-0 sm:gap-3 sm:px-5 sm:py-0",
                  PREVIEW_GRID,
                )}
                style={{
                  animationDelay: index < 10 ? `${index * 16}ms` : "0ms",
                }}
              >
                <div role="cell" className="min-w-0">
                  <span className="truncate font-mono text-[0.88rem] font-semibold tracking-tight text-[var(--desk-text)]">
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
                    <span className="line-clamp-2 min-w-0 text-[0.88rem] font-medium text-[var(--desk-text-secondary)] sm:line-clamp-1">
                      {row.title}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 md:hidden">
                    <CategoryChip highPriority={row.highPriority}>
                      {row.category}
                    </CategoryChip>
                    <time className="font-mono text-[0.72rem] font-medium tracking-tight whitespace-nowrap text-[var(--desk-text-muted)] tabular-nums sm:hidden">
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
                  <time className="inline-block max-w-full font-mono text-[0.72rem] font-medium tracking-tight whitespace-nowrap text-[var(--desk-text-dim)] tabular-nums">
                    {row.time}
                  </time>
                </div>

                <div role="cell" className="hidden min-w-0 justify-end lg:flex">
                  <div className="flex w-full min-w-0 flex-nowrap items-center justify-end gap-1">
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
            ))}
          </div>
        </section>

        <div className="mt-6 sm:mt-10">
          <PreLoginLandingSections />
        </div>
      </main>
    </PreLoginChrome>
  );
}
