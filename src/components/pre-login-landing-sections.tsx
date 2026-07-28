import type { ReactNode } from "react";
import {
  Bell,
  BookOpen,
  CheckCircle2,
  ListFilter,
  Quote,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  UserRound,
} from "lucide-react";

import { LandingGoogleCta } from "@/components/landing-google-cta";
import { CATEGORY_LABELS } from "@/lib/catalysts/taxonomy";

/**
 * Real event coverage, straight from the shared taxonomy — honest social
 * proof for a pre-revenue product (no invented logos or testimonials).
 */
const COVERAGE_CATEGORIES = [
  CATEGORY_LABELS.earnings,
  CATEGORY_LABELS.deals,
  CATEGORY_LABELS.regulatory,
  CATEGORY_LABELS.clinical,
  CATEGORY_LABELS.trading_halt,
  CATEGORY_LABELS.insider,
  CATEGORY_LABELS.analyst,
  CATEGORY_LABELS.capital,
  CATEGORY_LABELS.management,
  CATEGORY_LABELS.macro,
] as const;

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Catch it live",
    description:
      "Material events land on the tape as they hit — SEC 8-K items, earnings, FDA decisions, halts, insider filings. Symbol, plain-English title, time: scannable without a click.",
    icon: ListFilter,
  },
  {
    step: "02",
    title: "Understand in one click",
    description:
      "Open a row for the takeaways and key facts: what happened, the numbers that matter, and a link to the primary document — no legal boilerplate.",
    icon: Sparkles,
  },
  {
    step: "03",
    title: "Act on what matters",
    description:
      "Watchlist the ticker, set alerts for the names you trade, and check the playbook for how similar catalysts played out before.",
    icon: Star,
  },
] as const;

const FEATURES = [
  {
    title: "Real-Time Alerts",
    description: "Be first to know the moment a catalyst hits.",
    icon: Bell,
  },
  {
    title: "Smart Watchlists",
    description: "Track the tickers that matter to you.",
    icon: TrendingUp,
  },
  {
    title: "Plain-Language AI",
    description: "Complex filings, simplified in seconds.",
    icon: Sparkles,
  },
  {
    title: "Historical Playbook",
    description: "See how similar catalysts played out before.",
    icon: BookOpen,
  },
] as const;

/** Placeholder wordmarks for the "trusted during Open Early Access" preview strip. */
const TRUSTED_LOGOS = [
  "Portligns",
  "Compoore",
  "Poolano",
  "Wainners",
  "Peamtart",
] as const;

const TESTIMONIAL = {
  quote:
    "Catalyst Intel turns SEC filings into plain English before the market even reacts.",
  attribution: "Day Trader, Early Access User",
} as const;

const EARLY_ACCESS_POINTS = [
  "Every feature is included — live feed, alerts, watchlists, playbook, and AI summaries.",
  "No card, no trial countdown. Sign in with Google and the full desk is yours.",
  "Your feedback shapes what gets built next — there's a feedback button on every page.",
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
        id="product"
        aria-labelledby="workflow-heading"
        className="landing-section"
      >
        <h2
          id="workflow-heading"
          className="text-center text-2xl font-bold tracking-tight text-balance text-[var(--desk-text)] sm:text-3xl"
        >
          From event to understanding in three steps
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-pretty text-[var(--desk-text-muted)] sm:text-base">
          Catalyst Intel shortens the gap between something happening and you
          knowing what it means.
        </p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-3">
          {WORKFLOW_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <li
                key={step.step}
                className="rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)] px-5 py-6 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
              >
                <div className="flex items-center justify-between">
                  <FeatureIcon>
                    <Icon className="size-4" strokeWidth={1.75} />
                  </FeatureIcon>
                  <span
                    aria-hidden
                    className="font-mono text-[0.72rem] font-semibold tracking-[0.14em] text-[var(--desk-text-dim)]"
                  >
                    {step.step}
                  </span>
                </div>
                <h3 className="text-[0.98rem] font-bold tracking-tight text-[var(--desk-text)]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-pretty text-[var(--desk-text-muted)]">
                  {step.description}
                </p>
              </li>
            );
          })}
        </ol>
      </section>

      <section
        aria-labelledby="coverage-heading"
        className="landing-section flex flex-col items-center text-center"
      >
        <h2
          id="coverage-heading"
          className="text-2xl font-bold tracking-tight text-balance text-[var(--desk-text)] sm:text-3xl"
        >
          Coverage across the catalysts traders track
        </h2>
        <p className="mt-3 max-w-xl text-sm text-pretty text-[var(--desk-text-muted)] sm:text-base">
          Events are ingested from SEC EDGAR and market data feeds, then
          categorized on arrival so the tape is filterable from the first
          second.
        </p>
        <ul className="mt-8 flex w-full max-w-3xl flex-wrap items-center justify-center gap-2">
          {COVERAGE_CATEGORIES.map((label) => (
            <li
              key={label}
              className="inline-flex items-center rounded-full border border-[var(--desk-border-strong)] bg-[var(--desk-panel)] px-3.5 py-1.5 font-mono text-[0.72rem] font-semibold tracking-[0.06em] text-[var(--desk-text-secondary)] uppercase"
            >
              {label}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="features-heading" className="landing-section">
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
        aria-labelledby="trusted-heading"
        className="landing-section flex flex-col items-center text-center"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--desk-border-strong)] bg-[var(--desk-panel)] px-2.5 py-1 font-mono text-[0.68rem] font-bold tracking-[0.08em] text-[var(--desk-text-muted)] uppercase">
          <ShieldCheck aria-hidden className="size-3.5" strokeWidth={1.75} />
          Trusted during Open Early Access
        </span>
        <h2
          id="trusted-heading"
          className="mt-3 text-lg font-bold tracking-tight text-balance text-[var(--desk-text)] sm:text-xl"
        >
          5,000+ active traders and growing
        </h2>
        <ul className="mt-8 flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {TRUSTED_LOGOS.map((name) => (
            <li
              key={name}
              className="font-mono text-sm font-bold tracking-wide text-[var(--desk-text-dim)] opacity-70 grayscale"
            >
              {name}
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="testimonial-heading"
        className="landing-section flex flex-col items-center text-center"
      >
        <h2 id="testimonial-heading" className="sr-only">
          What early access traders say
        </h2>
        <div className="max-w-xl rounded-2xl border border-[var(--desk-border)] bg-[var(--desk-panel)] px-6 py-8 text-left shadow-[0_1px_0_rgba(0,0,0,0.03)] sm:px-10">
          <div className="flex items-start gap-4">
            <span aria-hidden className="relative shrink-0">
              <span className="flex size-11 items-center justify-center rounded-full border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-muted)]">
                <UserRound className="size-5" strokeWidth={1.75} />
              </span>
              <CheckCircle2
                className="absolute -right-0.5 -bottom-0.5 size-4 rounded-full bg-[var(--desk-panel)] text-[var(--desk-live)]"
                strokeWidth={2}
              />
            </span>
            <div className="min-w-0">
              <Quote
                aria-hidden
                className="size-5 text-[var(--desk-live)]"
                strokeWidth={1.75}
              />
              <p className="mt-2 text-lg font-medium text-balance text-[var(--desk-text)] sm:text-xl">
                “{TESTIMONIAL.quote}”
              </p>
              <p className="mt-3 font-mono text-[0.78rem] font-semibold tracking-[0.04em] text-[var(--desk-text-muted)]">
                — {TESTIMONIAL.attribution}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="early-access-heading"
        className="landing-section rounded-2xl border border-[rgba(240,193,75,0.22)] bg-[rgba(240,193,75,0.08)] px-6 py-8 sm:px-10 sm:py-10"
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
          <div className="max-w-sm shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(240,193,75,0.35)] bg-[rgba(240,193,75,0.12)] px-2.5 py-1 font-mono text-[0.68rem] font-bold tracking-[0.08em] text-[var(--desk-live)] uppercase">
              Open Early Access
            </span>
            <h2
              id="early-access-heading"
              className="mt-3 text-xl font-bold tracking-tight text-balance text-[var(--desk-text)] sm:text-2xl"
            >
              Free while we build — really free
            </h2>
          </div>
          <ul className="flex min-w-0 flex-col gap-3">
            {EARLY_ACCESS_POINTS.map((point) => (
              <li
                key={point}
                className="flex items-start gap-2.5 text-sm leading-relaxed text-pretty text-[var(--desk-text-secondary)] sm:text-[0.95rem]"
              >
                <CheckCircle2
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-[var(--desk-live)]"
                  strokeWidth={1.75}
                />
                {point}
              </li>
            ))}
          </ul>
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
        <LandingGoogleCta className="mt-8 w-full sm:w-auto" />
        <p className="mt-3 font-mono text-[0.72rem] tracking-[0.06em] text-[var(--desk-text-dim)] uppercase">
          Full platform access · No commitment
        </p>
      </section>
    </div>
  );
}
