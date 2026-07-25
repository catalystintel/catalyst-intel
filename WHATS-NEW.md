# What's new

Short release notes for founders / ops. Newest first.

The same content is shown on **Admin → What's new**
(`src/lib/ops/whats-new.ts` is the source of truth — update both the TS list
and keep this file in sync when you ship, or regenerate from that module).

## 2026-07-24 — Security hardening & error monitoring

- Webhook alerts reject private/local/metadata URLs (SSRF guard) and do not follow redirects.
- Public health probe at `/api/health` for uptime monitors (checks Turso reachability).
- Server + client errors report to PostHog Error tracking when PostHog is configured.
- Unauthenticated admin GET info endpoints now require admin session or cron secret.
- `/analytics` added to the proxy protect list (faster redirect for signed-out visitors).
- Baseline security headers (nosniff, Referrer-Policy, frame deny, Permissions-Policy).
- Dependabot now also watches npm dependencies (not only GitHub Actions).
- Monitoring checklist documented in DEPLOYMENT.md (PostHog alerts, uptime, GHA, Vercel).

## Platform map (always relevant)

### Stack

- Next.js App Router on Vercel — pages, APIs, and ingest jobs in one app.
- libSQL / Turso for app data (SQLite file locally).
- Supabase Auth only (Google OAuth) — no passwords in our DB.
- PostHog for product analytics + exception capture (optional if key unset).

### Schedule & ETL

- cron-job.org (external pinger, every 1 min in prod) hits `POST /api/admin/fetch/all` with `x-cron-secret`.
- Local: `npm run cron` (default every 1 min) or Admin → Fetch all / per-source.
- Phased A→B→C orchestrator — see FETCH-ORDER.md.
- Self-heal via stale `GET /api/catalysts`; 30-day retention; Admin ingestion audit.

### Vendors / sources

- Keyless Must: SEC EDGAR, Nasdaq Halts, Macro calendar, openFDA, ClinicalTrials.gov.
- Optional Should: Finnhub, Form4API, Polygon news + prices (soft-skip if keys missing).

### UI surfaces

- Live feed, article detail, watchlist, alerts, analytics, profile, Admin ops console.

### Docs

- ARCHITECTURE.md · FETCH-ORDER.md · DEPLOYMENT.md · README.md
