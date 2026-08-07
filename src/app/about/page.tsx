import type { Metadata } from "next";
import Link from "next/link";

import { PreLoginChrome } from "@/components/pre-login-chrome";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "About · Catalyst Intel",
  description:
    "Material market catalysts on a trading blotter — Symbol, Title, Time. Scan the event, open Details for the story, then act or dismiss.",
};

const BENEFITS = [
  {
    title: "Scan, don’t hunt",
    body: "A dense blotter for multi-monitor desks. Material catalysts land as rows you can read at a glance — not a headline firehose.",
  },
  {
    title: "Story before the chart",
    body: "Open any row for a plain-language summary and expanded event details. Understand the why before you size the trade.",
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
            About · Open Early Access
          </span>
          <h1 className="marketing-headline mt-3 text-3xl text-balance text-[var(--desk-text)] sm:text-4xl">
            Catalyst Intel
          </h1>
          <p className="mt-4 text-base text-pretty text-[var(--desk-text-secondary)] sm:text-lg">
            A real-time catalyst desk for traders who need the event story first
            — then the chart. For the desk, Catalyst Intel is the source.
          </p>
          <p className="mt-3 text-base text-pretty text-[var(--desk-text-muted)]">
            We&apos;re in Open Early Access: every available feature is free
            while we grow with early traders. Paid Pro plans come later — for
            now, sign in and use the full desk.
          </p>
        </section>

        <section className="space-y-4 border-t border-[var(--desk-border)] pt-10">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--desk-text)]">
            The desk
          </h2>
          <p className="text-pretty text-[var(--desk-text-secondary)]">
            Live material catalysts laid out for fast scanning. Each row carries{" "}
            <span className="font-mono text-[0.9em] text-[var(--desk-text)]">
              Symbol · Title · Time
            </span>
            .
          </p>
          <p className="text-pretty text-[var(--desk-text-secondary)]">
            The feed surfaces the catalyst early. Open Details for a
            plain-language summary and fuller event text — then act, dismiss, or
            quiet the name into your playbook.
          </p>
        </section>

        <section className="space-y-4 border-t border-[var(--desk-border)] pt-10">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--desk-text)]">
            Where we focus
          </h2>
          <p className="text-pretty text-[var(--desk-text-secondary)]">
            Material corporate and market events first — organized for traders
            who need the story before it becomes consensus noise.
          </p>
          <p className="text-pretty text-[var(--desk-text-secondary)]">
            Coverage expands over time on the same blotter: more event types,
            same Symbol · Title · Time scan.
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
            Sign in free during Open Early Access — full desk access, no card
            required. Scan catalysts as they land, structured for the desk.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/auth/login?next=%2Fcatalyst-feed"
              className={cn(
                buttonVariants({ size: "lg" }),
                "btn-press min-h-11 w-full justify-center bg-[var(--landing-primary,#00d4aa)] text-[var(--desk-accent-fg,#131722)] hover:bg-[var(--landing-primary-hover,#00b894)] sm:w-auto",
              )}
            >
              Continue with Google — free
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
