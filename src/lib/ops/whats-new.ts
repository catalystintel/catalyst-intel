/**
 * Ops-facing release notes + platform map for Admin (/admin).
 * Keep newest entries first. Prefer short bullets a non-engineer can skim.
 */

export type WhatsNewEntry = {
  /** ISO date (YYYY-MM-DD) when this landed on `dev` / staging. */
  date: string;
  title: string;
  bullets: string[];
};

/** Newest first — update this when shipping user-visible or ops-visible work. */
export const WHATS_NEW: WhatsNewEntry[] = [
  {
    date: "2026-07-31",
    title: "Preview / staging admin-only",
    bullets: [
      "Vercel Preview deployments (staging + PR preview links) require an allowlisted admin session.",
      "Non-admins hitting a preview URL see a sign-in message; OAuth for non-admins is dropped on callback.",
      "Report share links require a signed-in session (no anonymous API fetch).",
    ],
  },
  {
    date: "2026-07-25",
    title: "Open Early Access + feedback",
    bullets: [
      "Marketing and in-app banners announce Open Early Access — every feature is free while we grow traffic.",
      "Feedback box (bugs / feature requests / improvements) emails FEEDBACK_TO_EMAIL via Resend; also in the account menu.",
      "Profile notes full access during Early Access; Pro billing stays “coming soon” (not gated yet).",
    ],
  },
  {
    date: "2026-07-25",
    title: "Catalyst Feed URL rename",
    bullets: [
      "`/dashboard` is now `/catalyst-feed` — matches the sidebar label; old links 308-redirect automatically.",
      "Article deep link moved from `/dashboard/catalyst/[id]` to `/catalyst-feed/catalyst/[id]`.",
    ],
  },
  {
    date: "2026-07-24",
    title: "Security hardening & error monitoring",
    bullets: [
      "Webhook alerts reject private/local/metadata URLs (SSRF guard) and do not follow redirects.",
      "Public health probe at `/api/health` for uptime monitors (checks Turso reachability).",
      "Server + client errors report to PostHog Error tracking when PostHog is configured.",
      "Unauthenticated admin GET info endpoints now require admin session or cron secret.",
      "`/analytics` added to the proxy protect list (faster redirect for signed-out visitors).",
      "Baseline security headers (nosniff, Referrer-Policy, frame deny, Permissions-Policy).",
      "Dependabot now also watches npm dependencies (not only GitHub Actions).",
      "Monitoring checklist documented in DEPLOYMENT.md (PostHog alerts, uptime, GHA, Vercel).",
    ],
  },
];

/**
 * Living “swim the platform” map — stack, schedule, vendors, UI surfaces.
 * Point at canonical docs; don’t duplicate long runbooks here.
 */
export const PLATFORM_MAP: {
  title: string;
  bullets: string[];
}[] = [
  {
    title: "Stack",
    bullets: [
      "Next.js App Router on Vercel — pages, APIs, and ingest jobs in one app.",
      "libSQL / Turso for app data (SQLite file locally).",
      "Supabase Auth only (Google OAuth) — no passwords in our DB.",
      "PostHog for product analytics + exception capture (optional if key unset).",
    ],
  },
  {
    title: "Schedule & ETL",
    bullets: [
      "cron-job.org (external pinger, every 1 min in prod) hits `POST /api/admin/fetch/all` with `x-cron-secret`.",
      "Local: `npm run cron` (default every 1 min) or Admin → Fetch all / per-source.",
      "Phased A→B→C orchestrator — see FETCH-ORDER.md (Must keyless first, then keyed vendors).",
      "Self-heal: stale `GET /api/catalysts` can trigger a background refetch for signed-in traffic.",
      "30-day retention purge after multi-source runs; ingestion audit in Admin + `ingestion_runs`.",
    ],
  },
  {
    title: "Vendors / sources",
    bullets: [
      "Keyless Must: SEC EDGAR, Nasdaq Halts, Macro calendar, openFDA, ClinicalTrials.gov.",
      "Optional Should: Finnhub (earnings/FDA/news), Form4API, Polygon news + prices.",
      "Soft-skip when optional API keys are missing — never blocks the whole run.",
    ],
  },
  {
    title: "UI surfaces",
    bullets: [
      "Live feed `/catalyst-feed` — poll while tab visible; filters, watchlist, playbook/quiet mode.",
      "Article detail drawer / `/catalyst-feed/catalyst/[id]` — proof URL, materiality, takeaways.",
      "Watchlist, Alerts (email/webhook rules + test fire), Analytics, Profile.",
      "Reports digests — share links require a signed-in session; Preview hosts are admin-only.",
      "Admin (allowlisted emails) — ingest controls, run audit, migrations, NYSE status.",
    ],
  },
  {
    title: "Monitoring (after this release)",
    bullets: [
      "`GET /api/health` → wire UptimeRobot / Better Stack on staging + production URLs.",
      "PostHog → Error tracking + alert on exception spikes (needs `NEXT_PUBLIC_POSTHOG_KEY`).",
      "cron-job.org job history / failure notifications for ETL; GitHub Actions email for failed CI/migrations; Vercel deploy-failure notifications.",
      "Details: DEPLOYMENT.md → “Logging & monitoring plan”.",
    ],
  },
  {
    title: "Docs to keep open",
    bullets: [
      "ARCHITECTURE.md — diagram + TL;DR of how pieces connect.",
      "FETCH-ORDER.md — source catalog, phases, status meanings.",
      "DEPLOYMENT.md — env vars, secrets, cron, migrations, monitoring checklist.",
      "README.md — local setup.",
    ],
  },
];
