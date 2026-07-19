import Link from "next/link";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const DEMO_ROWS = [
  {
    ticker: "NVDA",
    type: "8-K",
    age: "12s",
    why: "Item 2.02 — preliminary quarterly results",
  },
  {
    ticker: "TSLA",
    type: "8-K",
    age: "48s",
    why: "Item 8.01 — other events, guidance update",
  },
  {
    ticker: "AMD",
    type: "8-K",
    age: "2m",
    why: "Item 1.01 — material definitive agreement",
  },
  {
    ticker: "PLTR",
    type: "8-K",
    age: "5m",
    why: "Item 5.02 — officer / director change",
  },
  {
    ticker: "SMCI",
    type: "8-K",
    age: "9m",
    why: "Item 2.05 — costs associated with exit",
  },
] as const;

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
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="desk-grid pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[55vh] bg-[radial-gradient(ellipse_at_top,oklch(0.45_0.06_250_/0.22),transparent_62%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent"
      />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="live-pulse inline-block size-2 rounded-full bg-amber-400"
          />
          <span className="text-base font-semibold tracking-tight sm:text-lg">
            Catalyst Intel
          </span>
        </div>
        <Link
          href="/login"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "btn-press",
          )}
        >
          Sign in
        </Link>
      </header>

      <main className="page-enter relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-10 px-5 pt-4 pb-16 sm:px-8">
        <div className="max-w-2xl">
          <p className="font-mono text-[0.7rem] tracking-[0.22em] text-amber-400/90 uppercase">
            Day-trader desk
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
            Catalyst Intel
          </h1>
          <p className="mt-4 max-w-lg text-base text-pretty text-muted-foreground sm:text-lg">
            Live SEC catalysts as they hit the wire — built for multi-monitor
            scanning, not another SaaS dashboard. Sign in and land on the feed.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg" }),
                "btn-press bg-amber-500 text-zinc-950 hover:bg-amber-400",
              )}
            >
              Open Live feed
            </Link>
            <span className="font-mono text-xs text-muted-foreground">
              Google sign-in · no password
            </span>
          </div>
        </div>

        <section
          aria-label="Feed preview"
          className="landing-feed overflow-hidden border border-border/70 bg-[oklch(0.17_0.016_255_/0.92)] shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
        >
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5 sm:px-4">
            <div className="flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.16em] uppercase">
              <span
                aria-hidden
                className="live-pulse inline-block size-1.5 rounded-full bg-amber-400"
              />
              <span className="text-amber-400">Live</span>
              <span className="text-muted-foreground">· SEC 8-K tape</span>
            </div>
            <span className="font-mono text-[0.65rem] text-muted-foreground">
              Preview
            </span>
          </div>
          <div className="grid grid-cols-[4.5rem_3.5rem_2.75rem_minmax(0,1fr)] gap-2 border-b border-border/50 px-3 py-2 font-mono text-[0.6rem] tracking-[0.12em] text-muted-foreground uppercase sm:grid-cols-[5.5rem_4rem_3rem_minmax(0,1fr)] sm:px-4">
            <span>Ticker</span>
            <span>Type</span>
            <span className="text-right">Age</span>
            <span>Why</span>
          </div>
          <ul className="divide-y divide-border/40">
            {DEMO_ROWS.map((row, index) => (
              <li
                key={row.ticker}
                className="feed-row grid grid-cols-[4.5rem_3.5rem_2.75rem_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 sm:grid-cols-[5.5rem_4rem_3rem_minmax(0,1fr)] sm:px-4"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <span className="font-mono text-[0.8rem] font-semibold text-steel-foreground">
                  {row.ticker}
                </span>
                <span className="font-mono text-[0.7rem] text-muted-foreground">
                  {row.type}
                </span>
                <span className="text-right font-mono text-[0.7rem] text-amber-200/85 tabular-nums">
                  {row.age}
                </span>
                <span className="truncate text-[0.8rem] text-foreground/85">
                  {row.why}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
