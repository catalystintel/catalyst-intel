import Link from "next/link";
import { redirect } from "next/navigation";

import { SectorPill } from "@/components/sector-pill";
import { buttonVariants } from "@/components/ui/button";
import type { EventCategoryKey } from "@/lib/jobs/parse-8k-items";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const PREVIEW_GRID =
  "grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[148px_132px_minmax(0,1fr)_150px] lg:grid-cols-[168px_148px_minmax(0,1fr)_168px]";

const DEMO_ROWS: {
  sourceName: string;
  sourceMeta: string;
  sector: string;
  tone: EventCategoryKey | "sec";
  title: string;
  time: string;
}[] = [
  {
    sourceName: "SEC EDGAR",
    sourceMeta: "8-K · NVDA",
    sector: "Earnings",
    tone: "earnings",
    title: "NVDA — preliminary quarterly results (Item 2.02)",
    time: "10:23 AM · Jul 20, 2026",
  },
  {
    sourceName: "SEC EDGAR",
    sourceMeta: "8-K · TSLA",
    sector: "Disclosure",
    tone: "disclosure",
    title: "TSLA — other events, guidance update (Item 8.01)",
    time: "10:18 AM · Jul 20, 2026",
  },
  {
    sourceName: "SEC EDGAR",
    sourceMeta: "8-K · AMD",
    sector: "M&A / Deals",
    tone: "deals",
    title: "AMD — material definitive agreement (Item 1.01)",
    time: "10:15 AM · Jul 20, 2026",
  },
  {
    sourceName: "SEC EDGAR",
    sourceMeta: "8-K · PLTR",
    sector: "Management",
    tone: "management",
    title: "PLTR — officer / director change (Item 5.02)",
    time: "10:12 AM · Jul 20, 2026",
  },
  {
    sourceName: "SEC EDGAR",
    sourceMeta: "8-K · SMCI",
    sector: "Restructuring",
    tone: "restructuring",
    title: "SMCI — costs associated with exit (Item 2.05)",
    time: "10:08 AM · Jul 20, 2026",
  },
];

export default async function Home() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect("/dashboard");
    }
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[var(--desk-app)]">
      <div
        aria-hidden
        className="desk-grid pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[55vh] bg-[radial-gradient(ellipse_at_top,rgba(79,143,217,0.14),transparent_62%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--desk-app)] to-transparent"
      />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="brand-mark relative size-7 shrink-0 rounded-lg"
          />
          <span className="text-base font-bold tracking-tight text-[var(--desk-text)] sm:text-lg">
            Catalyst Intel
          </span>
        </div>
        <Link
          href="/login"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "btn-press border-[var(--desk-border-strong)] bg-transparent text-[var(--desk-text-secondary)] hover:bg-white/[0.05] hover:text-[var(--desk-text)]",
          )}
        >
          Sign in
        </Link>
      </header>

      <main className="page-enter relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-5 pt-4 pb-16 sm:px-8">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(240,193,75,0.35)] bg-[rgba(240,193,75,0.12)] px-2.5 py-1 text-[0.68rem] font-bold tracking-[0.08em] text-[var(--desk-live)]">
            <span
              aria-hidden
              className="live-pulse size-1.5 rounded-full bg-[var(--desk-live)]"
            />
            LIVE
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-balance text-[var(--desk-text)] sm:text-5xl">
            Catalyst Intel
          </h1>
          <p className="mt-4 max-w-lg text-base text-pretty text-[var(--desk-text-secondary)] sm:text-lg">
            Live SEC catalysts as they hit EDGAR — Source, Sector, Title, and
            Time on a trading-desk feed built for multi-monitor scanning.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg" }),
                "btn-press bg-[var(--desk-live)] text-[#1a1520] hover:bg-[#f5cc63]",
              )}
            >
              Continue with Google
            </Link>
            <span className="font-mono text-xs text-[var(--desk-text-muted)]">
              Sign in · no password
            </span>
          </div>
        </div>

        <section
          aria-label="Feed preview"
          className="landing-feed overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)] shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
        >
          <div className="flex items-center justify-between border-b border-[var(--desk-border)] bg-[var(--desk-header)] px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(240,193,75,0.35)] bg-[rgba(240,193,75,0.12)] px-2.5 py-1 text-[0.68rem] font-bold tracking-[0.08em] text-[var(--desk-live)]">
                <span
                  aria-hidden
                  className="live-pulse size-1.5 rounded-full bg-[var(--desk-live)]"
                />
                LIVE
              </span>
              <span className="hidden truncate text-[0.86rem] text-[var(--desk-text-muted)] sm:inline">
                Latest News preview
              </span>
            </div>
            <span className="font-mono text-[0.72rem] tracking-[0.08em] text-[var(--desk-text-dim)] uppercase">
              Preview
            </span>
          </div>

          <div
            role="table"
            aria-label="News feed preview"
            className="flex flex-col"
          >
            <div
              role="row"
              className={cn(
                "grid h-10 items-center gap-3 border-b border-[var(--desk-border-strong)] bg-[#0f1620] px-4 font-mono text-[0.66rem] font-medium tracking-[0.12em] text-[#6d7d92] uppercase sm:gap-4 sm:px-5",
                PREVIEW_GRID,
              )}
            >
              <div role="columnheader" className="hidden sm:block">
                Source
              </div>
              <div role="columnheader" className="hidden sm:block">
                Sector
              </div>
              <div role="columnheader">Title</div>
              <div role="columnheader" className="text-right">
                Time
              </div>
            </div>

            {DEMO_ROWS.map((row, index) => (
              <article
                key={`${row.sourceMeta}-${row.time}`}
                role="row"
                className={cn(
                  "feed-row grid min-h-[60px] items-center gap-3 border-b border-[rgba(28,39,54,0.95)] px-4 sm:gap-4 sm:px-5",
                  PREVIEW_GRID,
                )}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <div
                  role="cell"
                  className="hidden min-w-0 items-center gap-2.5 sm:flex"
                >
                  <span
                    aria-hidden
                    className="grid size-7 shrink-0 place-items-center rounded-[7px] bg-[#1a4a7a] text-[0.7rem] font-bold text-white"
                  >
                    S
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[0.86rem] font-semibold text-[var(--desk-text)]">
                      {row.sourceName}
                    </span>
                    <span className="truncate text-[0.72rem] text-[var(--desk-text-dim)]">
                      {row.sourceMeta}
                    </span>
                  </span>
                </div>
                <div role="cell" className="hidden sm:block">
                  <SectorPill label={row.sector} tone={row.tone} />
                </div>
                <div role="cell" className="min-w-0">
                  <span className="line-clamp-2 text-[0.92rem] font-medium text-[var(--desk-text)] sm:line-clamp-1">
                    {row.title}
                  </span>
                  <span className="mt-1 block font-mono text-[0.7rem] text-[var(--desk-text-dim)] sm:hidden">
                    {row.sourceMeta} · {row.sector}
                  </span>
                </div>
                <div
                  role="cell"
                  className="text-right font-mono text-[0.78rem] text-[var(--desk-text-muted)] tabular-nums"
                >
                  <time>{row.time}</time>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
