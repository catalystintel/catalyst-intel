import type { Metadata } from "next";
import Link from "next/link";

import { PreLoginChrome } from "@/components/pre-login-chrome";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "About · Catalyst Intel",
  description:
    "Material SEC events on a trading blotter — Symbol, Title, Time. Scan the catalyst, open Read for the story, then act or dismiss.",
};

const BENEFITS = [
  {
    title: "Scan, don’t hunt",
    body: "A dense blotter for multi-monitor desks. Material events land as rows you can read at a glance — not a headline firehose.",
  },
  {
    title: "Story before the chart",
    body: "Open any row for a plain-language summary and the path back to the filing. Understand the why before you size the trade.",
  },
  {
    title: "Your book, not the whole tape",
    body: "Filters, watchlists, quiet playbook, and alerts narrow the stream to the names and event types you actually trade.",
  },
] as const;

export default function AboutPage() {
  return (
    <PreLoginChrome glowClassName="h-[45vh]" activeNav="about">
      <main className="page-enter relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col gap-14 px-5 pt-6 pb-16 sm:px-8 sm:pt-10">
        <section className="max-w-2xl">
          <span className="font-mono text-[0.72rem] font-medium tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
            About
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-[var(--desk-text)] sm:text-4xl">
            Catalyst Intel
          </h1>
          <p className="mt-4 text-base text-pretty text-[var(--desk-text-secondary)] sm:text-lg">
            A real-time catalyst desk for traders who need the event story first
            — then the chart.
          </p>
        </section>

        <section className="space-y-4 border-t border-[var(--desk-border)] pt-10">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--desk-text)]">
            The desk
          </h2>
          <p className="text-pretty text-[var(--desk-text-secondary)]">
            Live material SEC events — especially 8-Ks — ingested as they hit
            EDGAR and laid out for fast scanning. Each row carries{" "}
            <span className="font-mono text-[0.9em] text-[var(--desk-text)]">
              Symbol · Title · Time
            </span>
            .
          </p>
          <p className="text-pretty text-[var(--desk-text-secondary)]">
            The feed surfaces the catalyst early. Open Read for a plain-language
            summary and a path back to the filing so you can verify before you
            trade.
          </p>
        </section>

        <section className="space-y-4 border-t border-[var(--desk-border)] pt-10">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--desk-text)]">
            Where we focus
          </h2>
          <p className="text-pretty text-[var(--desk-text-secondary)]">
            SEC filings first. That is the core of the desk today — material
            events organized for traders who need the story before it becomes
            consensus noise.
          </p>
          <p className="text-pretty text-[var(--desk-text-secondary)]">
            FDA and clinical catalysts are next: same blotter, broader coverage
            over time.
          </p>
        </section>

        <section className="space-y-6 border-t border-[var(--desk-border)] pt-10">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--desk-text)]">
            Built for how you trade
          </h2>
          <ul className="grid gap-6 sm:gap-7">
            {BENEFITS.map((item) => (
              <li key={item.title} className="space-y-1.5">
                <h3 className="text-[0.95rem] font-semibold text-[var(--desk-text)]">
                  {item.title}
                </h3>
                <p className="text-pretty text-[var(--desk-text-secondary)]">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-[var(--desk-border)] pt-10">
          <p className="max-w-xl text-pretty text-[var(--desk-text-secondary)]">
            Sign in and open the live feed — scan catalysts as they land,
            structured for the desk.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg" }),
                "btn-press min-h-11 w-full justify-center bg-[var(--desk-live)] text-[#1a1520] hover:bg-[#f5cc63] sm:w-auto",
              )}
            >
              Continue with Google
            </Link>
            <Link
              href="/"
              className="text-sm text-[var(--desk-text-muted)] transition-colors hover:text-[var(--desk-text)]"
            >
              Back to home
            </Link>
          </div>
        </section>
      </main>
    </PreLoginChrome>
  );
}
