import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, BookOpen, Medal, Sparkles, Star, UserRound } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PARTNER_LOGOS = [
  { name: "Porligins", mark: "◇" },
  { name: "Compoore", mark: "△" },
  { name: "Poolano", mark: "○" },
  { name: "Wianners", mark: "□" },
  { name: "Peanrant", mark: "⬡" },
] as const;

const FEATURES = [
  {
    title: "Real-Time Alerts",
    description: "get notified the moment a catalyst hits",
    icon: Bell,
  },
  {
    title: "Smart Watchlists",
    description: "track the tickers that matter to you",
    icon: Star,
  },
  {
    title: "Plain-Language AI Summaries",
    description: "complex filings explained simply",
    icon: Sparkles,
  },
  {
    title: "Historical Playbook",
    description: "see how similar catalysts played out before",
    icon: BookOpen,
  },
] as const;

function FeatureIcon({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="mb-4 inline-flex size-9 items-center justify-center rounded-md bg-[rgba(240,193,75,0.16)] text-[var(--desk-live)]"
    >
      {children}
    </span>
  );
}

export function PreLoginLandingSections() {
  return (
    <div className="flex w-full flex-col gap-20 sm:gap-24">
      <section
        aria-labelledby="social-proof-heading"
        className="landing-section flex flex-col items-center text-center"
      >
        <span
          aria-hidden
          className="mb-4 inline-flex size-10 items-center justify-center rounded-full bg-[rgba(240,193,75,0.18)] text-[var(--desk-live)]"
        >
          <Medal className="size-5" strokeWidth={1.75} />
        </span>
        <h2
          id="social-proof-heading"
          className="text-2xl font-bold tracking-tight text-balance text-[var(--desk-text)] sm:text-3xl"
        >
          Trusted during Open Early Access
        </h2>
        <p className="mt-3 max-w-lg text-sm text-pretty text-[var(--desk-text-muted)] sm:text-base">
          Built for traders who need the catalyst story before the crowd
        </p>
        <ul className="mt-10 flex w-full max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-5 sm:gap-x-10">
          {PARTNER_LOGOS.map((logo) => (
            <li
              key={logo.name}
              className="flex items-center gap-2 font-mono text-[0.78rem] font-medium tracking-[0.04em] text-[var(--desk-text-dim)] uppercase sm:text-[0.82rem]"
            >
              <span aria-hidden className="text-base leading-none opacity-70">
                {logo.mark}
              </span>
              {logo.name}
            </li>
          ))}
        </ul>
      </section>

      <section
        id="product"
        aria-labelledby="features-heading"
        className="landing-section"
      >
        <h2
          id="features-heading"
          className="text-center text-2xl font-bold tracking-tight text-balance text-[var(--desk-text)] sm:text-3xl"
        >
          Everything you need to catch the catalyst
        </h2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <li
                key={feature.title}
                className="rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)] px-5 py-6 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
              >
                <FeatureIcon>
                  <Icon className="size-4" strokeWidth={1.75} />
                </FeatureIcon>
                <h3 className="text-[0.95rem] font-bold tracking-tight text-[var(--desk-text)]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-pretty text-[var(--desk-text-muted)]">
                  {feature.description}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-label="Testimonial"
        className="landing-section rounded-2xl border border-[rgba(240,193,75,0.22)] bg-[rgba(240,193,75,0.1)] px-6 py-8 sm:px-10 sm:py-10"
      >
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-8">
          <span
            aria-hidden
            className="inline-flex size-16 shrink-0 items-center justify-center rounded-full border border-[var(--desk-border-strong)] bg-[var(--desk-panel)] text-[var(--desk-text-dim)]"
          >
            <UserRound className="size-7" strokeWidth={1.5} />
          </span>
          <blockquote className="min-w-0">
            <p className="text-xl leading-snug font-medium tracking-tight text-pretty text-[var(--desk-text)] sm:text-2xl">
              &ldquo;Catalyst Intel turns SEC filings into plain English before
              the market even reacts.&rdquo;
            </p>
            <footer className="mt-4 text-sm text-[var(--desk-text-muted)]">
              — Day Trader, Early Access User
            </footer>
          </blockquote>
        </div>
      </section>

      <section
        aria-labelledby="final-cta-heading"
        className="landing-section flex flex-col items-center pb-4 text-center sm:pb-8"
      >
        <h2
          id="final-cta-heading"
          className="max-w-2xl text-2xl font-bold tracking-tight text-balance text-[var(--desk-text)] sm:text-3xl"
        >
          Never miss a market-moving catalyst again
        </h2>
        <p className="mt-3 text-sm text-pretty text-[var(--desk-text-muted)] sm:text-base">
          Free during Open Early Access — no card required
        </p>
        <Link
          href="/login"
          className={cn(
            buttonVariants({ size: "lg" }),
            "btn-press mt-8 min-h-11 w-full justify-center bg-[var(--desk-live)] text-[#121212] hover:brightness-110 sm:w-auto",
          )}
        >
          Continue with Google — free
        </Link>
      </section>
    </div>
  );
}
