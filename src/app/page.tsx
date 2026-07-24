import Link from "next/link";
import { redirect } from "next/navigation";

import { PreLoginChrome } from "@/components/pre-login-chrome";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const PREVIEW_GRID =
  "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_78px_72px_72px] lg:grid-cols-[minmax(0,1fr)_78px_80px_80px_80px]";

const DEMO_ROWS: {
  ticker: string;
  event: string;
  impact: "HIGH" | "MED" | "LOW";
  title: string;
  time: string;
}[] = [
  {
    ticker: "NVDA",
    event: "8-K",
    impact: "HIGH",
    title: "Item 2.02 — Results of Operations and Financial Condition",
    time: "10:23 AM",
  },
  {
    ticker: "TSLA",
    event: "8-K",
    impact: "HIGH",
    title: "Item 8.01 — Other Events · guidance update",
    time: "10:18 AM",
  },
  {
    ticker: "AMD",
    event: "8-K",
    impact: "MED",
    title: "Item 1.01 — Material definitive agreement",
    time: "10:15 AM",
  },
  {
    ticker: "JPM",
    event: "8-K",
    impact: "LOW",
    title: "Item 5.02 — Departure of directors or certain officers",
    time: "10:12 AM",
  },
  {
    ticker: "MRK",
    event: "8-K",
    impact: "HIGH",
    title: "Item 8.01 — Other Events · FDA decision referenced",
    time: "10:08 AM",
  },
];

function ImpactChip({ impact }: { impact: "HIGH" | "MED" | "LOW" }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-sm border px-1.5 py-0.5 font-mono text-[0.62rem] font-semibold tracking-wide",
        impact === "HIGH"
          ? "border-[rgba(240,193,75,0.45)] bg-[rgba(240,193,75,0.14)] text-[var(--desk-live)]"
          : impact === "MED"
            ? "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)]"
            : "border-[var(--desk-border)] text-[var(--desk-text-muted)]",
      )}
    >
      {impact}
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
      redirect("/dashboard");
    }
  }

  return (
    <PreLoginChrome glowClassName="h-[55vh]">
      <main className="page-enter relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-start gap-8 px-4 pt-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:justify-center sm:gap-10 sm:px-8 sm:pt-4 sm:pb-16">
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
            Material SEC filings on a black-and-white trading blotter — Title,
            Time, Event. Open Read for a plain-language summary.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg" }),
                "btn-press min-h-11 w-full justify-center bg-[var(--desk-live)] text-[#121212] hover:brightness-110 sm:w-auto",
              )}
            >
              Continue with Google
            </Link>
            <span className="font-mono text-xs text-[var(--desk-text-muted)]">
              Sign in · no password
            </span>
          </div>
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 sm:hidden">
          <div className="pointer-events-auto border-t border-[var(--desk-border)] bg-[var(--desk-app)]/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg" }),
                "btn-press min-h-12 w-full justify-center bg-[var(--desk-live)] text-[#121212] hover:brightness-110",
              )}
            >
              Continue with Google
            </Link>
          </div>
        </div>

        <section
          aria-label="Feed preview"
          className="landing-feed overflow-hidden rounded-lg border border-[var(--desk-border)] bg-[var(--desk-panel)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
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
                Live tape preview
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
                "grid h-10 items-center gap-3 border-b border-[var(--desk-border-strong)] bg-[var(--desk-header)] px-4 font-mono text-[0.62rem] font-medium tracking-[0.12em] text-[var(--desk-text-dim)] uppercase sm:gap-4 sm:px-5",
                PREVIEW_GRID,
              )}
            >
              <div role="columnheader">Title</div>
              <div role="columnheader" className="hidden text-right sm:block">
                Time
              </div>
              <div role="columnheader" className="hidden sm:block">
                Event
              </div>
              <div role="columnheader" className="hidden sm:block">
                Ticker
              </div>
              <div role="columnheader" className="hidden sm:block">
                Impact
              </div>
            </div>

            {DEMO_ROWS.map((row, index) => (
              <article
                key={`${row.ticker}-${row.time}`}
                role="row"
                className={cn(
                  "feed-row grid min-h-[56px] items-center gap-3 border-b border-[var(--desk-border)] px-4 py-3 sm:gap-4 sm:px-5 sm:py-0",
                  PREVIEW_GRID,
                )}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <div role="cell" className="min-w-0">
                  <span className="line-clamp-2 text-[0.88rem] font-medium text-[var(--desk-text-secondary)] sm:line-clamp-1">
                    {row.title}
                  </span>
                  <div className="mt-1.5 flex flex-col gap-1 sm:hidden">
                    <time className="font-mono text-[0.7rem] text-[var(--desk-text-muted)] tabular-nums">
                      {row.time}
                    </time>
                    <span className="font-mono text-[0.68rem] text-[var(--desk-text-dim)]">
                      {row.event}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-[0.75rem] font-semibold text-[var(--desk-text)]">
                        {row.ticker}
                      </span>
                      <ImpactChip impact={row.impact} />
                    </span>
                  </div>
                </div>
                <div
                  role="cell"
                  className="hidden text-right font-mono text-[0.72rem] text-[var(--desk-text-dim)] tabular-nums sm:block"
                >
                  <time>{row.time}</time>
                </div>
                <div role="cell" className="hidden sm:block">
                  <span className="rounded-sm border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-1.5 py-0.5 font-mono text-[0.68rem] text-[var(--desk-text-secondary)]">
                    {row.event}
                  </span>
                </div>
                <div
                  role="cell"
                  className="hidden font-mono text-[0.88rem] font-semibold text-[var(--desk-text)] sm:block"
                >
                  {row.ticker}
                </div>
                <div role="cell" className="hidden sm:block">
                  <ImpactChip impact={row.impact} />
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </PreLoginChrome>
  );
}
