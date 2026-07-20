import type { Metadata } from "next";
import Link from "next/link";

import { PreLoginChrome } from "@/components/pre-login-chrome";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "About us · Catalyst Intel",
  description:
    "A real-time catalyst triage desk for traders who trade the why — live SEC material events on a dense trading-desk feed.",
};

const BENEFITS = [
  {
    title: "Speed with structure",
    body: "Material events land in a dense desk feed — Source, Sector, Title, and Time·date — so you can scan across monitors without hunting headlines.",
  },
  {
    title: "Trust the source",
    body: "Every row deep-links back to the filing. Verify the catalyst yourself before you size the trade.",
  },
  {
    title: "Triage your book",
    body: "Narrow the stream with filters, watchlists, and alerts so the desk stays focused on what moves your names — not the whole tape.",
  },
] as const;

export default function AboutPage() {
  return (
    <PreLoginChrome glowClassName="h-[45vh]" activeNav="about">
      <main className="page-enter relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col gap-14 px-5 pt-6 pb-16 sm:px-8 sm:pt-10">
        <section className="max-w-2xl">
          <span className="font-mono text-[0.72rem] font-medium tracking-[0.14em] text-[var(--desk-accent-fg)] uppercase">
            About us
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance text-[var(--desk-text)] sm:text-4xl">
            Catalyst Intel
          </h1>
          <p className="mt-4 text-base text-pretty text-[var(--desk-text-secondary)] sm:text-lg">
            A real-time catalyst triage desk for traders who trade the why — not
            the chart alone.
          </p>
        </section>

        <section className="space-y-4 border-t border-[var(--desk-border)] pt-10">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--desk-text)]">
            What you get
          </h2>
          <p className="text-pretty text-[var(--desk-text-secondary)]">
            Live SEC material events — especially 8-Ks — ingested, normalized,
            and scored into a trading-desk feed built for multi-monitor
            scanning. Each row carries the fields you need at a glance:{" "}
            <span className="font-mono text-[0.9em] text-[var(--desk-text)]">
              Source · Sector · Title · Time·date
            </span>
            .
          </p>
          <p className="text-pretty text-[var(--desk-text-secondary)]">
            Open any item and jump straight to the filing. The feed is there to
            surface the catalyst early; the deep-link is there so you can trust
            it.
          </p>
        </section>

        <section className="space-y-4 border-t border-[var(--desk-border)] pt-10">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--desk-text)]">
            Where we focus
          </h2>
          <p className="text-pretty text-[var(--desk-text-secondary)]">
            SEC filings first. That is the core of the desk today — material
            events as they hit EDGAR, organized for traders who need the story
            before it becomes consensus noise.
          </p>
          <p className="text-pretty text-[var(--desk-text-secondary)]">
            FDA and clinical catalysts are planned as a second source family.
            Same triage mindset; broader catalyst coverage over time.
          </p>
        </section>

        <section className="space-y-6 border-t border-[var(--desk-border)] pt-10">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--desk-text)]">
            Built for the desk
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
            Open the live feed and scan catalysts as they land — structured for
            the desk, linked to the source.
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
