# Environments & deployment

Three environments, one app:

| Environment    | Git branch                       | Database                 | Hosting                         |
| -------------- | -------------------------------- | ------------------------ | ------------------------------- |
| **Local**      | feature branches on your machine | SQLite file (`local.db`) | `npm run dev`                   |
| **Staging**    | `dev`                            | Turso (staging DB)       | Vercel Preview deploy for `dev` |
| **Production** | `main`                           | Turso (production DB)    | Vercel Production               |

## Branch / CI / CD rules

- Feature work: cut from `dev` → PR **into `dev`** (never commit directly to `dev` or `main`).
- Promote to production only on explicit request: merge `dev` → `main`.
- **GitHub Actions CI** (`.github/workflows/ci.yml`): lint + unit tests + build on
  - push to `dev` or `main`
  - pull requests **targeting `dev`**
    (This is a single Next.js app - tests cover both frontend pages and backend API/lib code.)
- **Vercel CD** (`vercel.json`): deploys **only** on push to `dev` (staging) and `main`
  (production). Feature branches do **not** get Vercel deploys.
- **Scheduled ETL** (`.github/workflows/fetch-sec-edgar-cron.yml`): scheduled GitHub Action hits
  both the production and staging URLs' `/api/admin/fetch/all` multi-source orchestrator with
  `x-cron-secret` (matrix job, each side optional). Inert until that environment's secrets are
  set. See "Why GitHub Actions cron" below for the observed real-world cadence and the in-app
  self-healing backstop.

## Env vars cheat sheet

### Local (`.env.local` on your machine)

| Variable                           | Required? | Notes                                                                                                   |
| ---------------------------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                     | Yes       | `file:./local.db` (default is fine)                                                                     |
| `NEXT_PUBLIC_SUPABASE_URL`         | Yes       | Supabase Project Settings → API                                                                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | Yes       | Supabase Project Settings → API                                                                         |
| `SEC_EDGAR_USER_AGENT`             | Yes       | e.g. `you@email.com CatalystIntel/0.1`                                                                  |
| `CRON_INTERVAL_MINUTES`            | No        | Default `2` for `npm run cron`                                                                          |
| `NEXT_PUBLIC_POSTHOG_KEY`          | No        | PostHog Project API key; omit to disable analytics                                                      |
| `NEXT_PUBLIC_POSTHOG_HOST`         | No        | Default `https://us.i.posthog.com`                                                                      |
| `ADMIN_EMAILS`                     | No        | Comma-separated admin emails; defaults to `zhbar10@gmail.com,omer.nachshon@gmail.com`                   |
| `FINNHUB_API_KEY`                  | No        | Finnhub: NYSE listings, earnings/FDA calendars, news (soft-fail)                                        |
| `POLYGON_API_KEY`                  | No        | Polygon/Massive news + historical_impact enrichment (soft-fail; free tier ~5 req/min, no same-day aggs) |
| `MASSIVE_API_KEY`                  | No        | Alias for `POLYGON_API_KEY`                                                                             |
| `FORM4_API_KEY`                    | No        | Optional Form4API enrichment (EDGAR Form 4 still works without it)                                      |
| `LIBSQL_URL` / `LIBSQL_AUTH_TOKEN` | No        | Leave unset locally - use the SQLite file                                                               |
| `CRON_SECRET`                      | No        | Only needed for remote cron callers                                                                     |

Auth is **Google OAuth only** via Supabase. Passwords are never collected or stored in our DB
(our `users` table only has id / supabase user id / email / role / subscription).

**Supabase Auth URL allowlist (required for phone + desktop sign-in):** in the Supabase
dashboard → **Authentication → URL Configuration**, set:

| Setting                  | Exact value                                       |
| ------------------------ | ------------------------------------------------- |
| Site URL                 | `https://catalyst-intel.vercel.app`               |
| Redirect URLs            | `https://catalyst-intel.vercel.app/auth/callback` |
| Redirect URLs            | `http://localhost:3000/auth/callback`             |
| Redirect URLs (optional) | `https://<your-preview>.vercel.app/auth/callback` |

Also add `https://catalyst-intel.vercel.app` (and localhost) under Google Cloud → OAuth client
→ **Authorized JavaScript origins**. Missing production redirect URLs are a common cause of
“works on desktop / fails on phone” OAuth returns.

**Phone still can’t enter after layout fixes?** Confirm the allowlist above, then on the phone:

1. Open Safari (not an in-app browser from Messages/Instagram/etc.).
2. Visit `https://catalyst-intel.vercel.app` directly.
3. Tap **Continue with Google** (sticky bar on phones, or Sign in).
4. If it returns to `/login` with an error: **Settings → Safari → Clear History and Website Data**
   (or per-site: Aa → Website Settings → clear data for `catalyst-intel.vercel.app`), then retry.
5. Avoid “Prevent Cross-Site Tracking” workarounds that block first-party auth cookies mid-redirect;
   our cookies are first-party on `catalyst-intel.vercel.app` with `SameSite=Lax`.

OAuth start uses the browser client + `GET /auth/login` (PKCE cookies on the redirect response)
so iOS Safari does not lose the verifier the way a Server Action `redirect()` sometimes did.

**Admin access** is enforced server-side from the verified Supabase session email against
`ADMIN_EMAILS` (or the built-in defaults). The local `users.role` column is synced as a cache
and is **not** the source of truth — do not rely on `npm run make-admin` alone. Manual fetch
via `/admin` uses the same allowlist; GitHub Actions cron still uses `x-cron-secret`.

## Multi-source fetch order

Canonical Must → Should order and phased runtime are documented in
**[FETCH-ORDER.md](FETCH-ORDER.md)** (`src/lib/jobs/catalyst-sources.ts`).

**Display order:** SEC EDGAR → Nasdaq Halts → Finnhub → openFDA → ClinicalTrials →
Polygon news → Polygon prices → Form4API (optional).

**Runtime phases:** A keyless parallel → B Finnhub + Form4API → C Polygon news
then prices (sequential). `POST /api/admin/fetch/all` returns `fetchOrder`,
`phases`, and ordered `sources`.

### API rate limiting

Per-IP fixed-window limits live in `src/lib/http/rate-limit.ts` (in-memory Map):

| Route                                        | Default          | Notes                                 |
| -------------------------------------------- | ---------------- | ------------------------------------- |
| `GET /api/catalysts`                         | 90 / minute / IP | Live feed soft-refetch                |
| `POST /api/admin/fetch/all` (session)        | 6 / minute / IP  | Admin multi-source orchestrator       |
| `POST /api/admin/fetch/[source]` (session)   | 6 / minute / IP  | Per-source admin trigger              |
| `POST /api/admin/fetch/sec-edgar` (session)  | 6 / minute / IP  | Legacy SEC-only trigger (still works) |
| Same admin routes with valid `x-cron-secret` | **bypassed**     | GitHub Actions cron must keep working |

Responses that exceed the limit return **429** with `Retry-After` and `X-RateLimit-*`
headers. This store is **per Vercel isolate** — fine for MVP spam protection; shared Redis
(e.g. Upstash) would be needed later for strict multi-instance global limits. No Upstash
env vars are required today.

### Staging (Vercel → Environment: **Preview**, used by the `dev` branch)

| Variable                        | Required?   | Notes                                                       |
| ------------------------------- | ----------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes         | Same Supabase project is fine for MVP                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes         | Same as local                                               |
| `SEC_EDGAR_USER_AGENT`          | Yes         | Same contact string is fine                                 |
| `LIBSQL_URL`                    | Yes         | Turso **staging** DB URL                                    |
| `LIBSQL_AUTH_TOKEN`             | Yes         | Turso **staging** DB token                                  |
| `NEXT_PUBLIC_POSTHOG_KEY`       | Recommended | Same PostHog project is fine for MVP                        |
| `NEXT_PUBLIC_POSTHOG_HOST`      | Recommended | `https://us.i.posthog.com` or EU host                       |
| `ADMIN_EMAILS`                  | No          | Override admin allowlist if needed (same defaults as local) |
| `CRON_SECRET`                   | Recommended | So you can manually trigger fetch against staging           |
| `FINNHUB_API_KEY`               | No          | Enables Finnhub catalysts + NYSE listings (Admin / cron)    |
| `POLYGON_API_KEY`               | No          | Enables Polygon/Benzinga news + price enrichment            |
| `FORM4_API_KEY`                 | No          | Optional Form4API enrichment                                |
| `RESEND_API_KEY`                | No          | Enables email alert delivery (webhook works without it)     |
| `RESEND_FROM_EMAIL`             | No          | Optional From for Resend (defaults to onboarding sender)    |

### Production (Vercel → Environment: **Production**, used by `main`)

| Variable                        | Required?   | Notes                                                       |
| ------------------------------- | ----------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes         | Same Supabase project is fine for MVP                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes         | Same as local/staging                                       |
| `SEC_EDGAR_USER_AGENT`          | Yes         | Same contact string is fine                                 |
| `LIBSQL_URL`                    | Yes         | Turso **production** DB URL (separate DB)                   |
| `LIBSQL_AUTH_TOKEN`             | Yes         | Turso **production** DB token                               |
| `NEXT_PUBLIC_POSTHOG_KEY`       | Recommended | Same PostHog project is fine for MVP                        |
| `NEXT_PUBLIC_POSTHOG_HOST`      | Recommended | `https://us.i.posthog.com` or EU host                       |
| `ADMIN_EMAILS`                  | No          | Override admin allowlist if needed (same defaults as local) |
| `CRON_SECRET`                   | Yes         | Must match the GitHub repo secret below                     |
| `FINNHUB_API_KEY`               | No          | Enables Finnhub catalysts + NYSE listings (Admin / cron)    |
| `POLYGON_API_KEY`               | No          | Enables Polygon/Benzinga news + price enrichment            |
| `FORM4_API_KEY`                 | No          | Optional Form4API enrichment                                |
| `RESEND_API_KEY`                | No          | Enables email alert delivery (webhook works without it)     |
| `RESEND_FROM_EMAIL`             | No          | Optional From for Resend                                    |

### GitHub repo secrets (for the scheduled ETL workflow)

`fetch-sec-edgar-cron.yml` runs a matrix job against **both** environments, so staging gets the
same automated ingestion attempts as production. Each pair below is independent — a missing pair
just skips that environment's job (logs a message, exits 0) instead of failing the workflow.

| Secret                | Notes                                                                               |
| --------------------- | ----------------------------------------------------------------------------------- |
| `PROD_APP_URL`        | Production Vercel URL, e.g. `https://catalyst-intel.vercel.app` (no trailing slash) |
| `CRON_SECRET`         | Same value as Vercel **Production** `CRON_SECRET`                                   |
| `STAGING_APP_URL`     | Staging (Preview) Vercel URL for the `dev` branch (no trailing slash)               |
| `STAGING_CRON_SECRET` | Same value as Vercel **Preview** `CRON_SECRET`                                      |

```bash
gh secret set PROD_APP_URL --body "https://<your-production-domain>"
gh secret set CRON_SECRET --body "<same value as Vercel Production>"
gh secret set STAGING_APP_URL --body "https://<your-staging-preview-domain>"
gh secret set STAGING_CRON_SECRET --body "<same value as Vercel Preview>"
```

### GitHub repo secrets (for the deploy migration workflow)

`migrate.yml` runs `drizzle-kit migrate` from GitHub Actions on every push to `main` /
`dev`, as an explicit, visible-in-Actions step in addition to the migration Vercel's own
build already runs. Missing secrets skip that push's job (logs a message, exits 0)
instead of failing the workflow - Vercel's build-time migration still applies either way.

| Secret                      | Notes                                                   |
| --------------------------- | ------------------------------------------------------- |
| `PROD_LIBSQL_URL`           | Same value as Vercel **Production** `LIBSQL_URL`        |
| `PROD_LIBSQL_AUTH_TOKEN`    | Same value as Vercel **Production** `LIBSQL_AUTH_TOKEN` |
| `STAGING_LIBSQL_URL`        | Same value as Vercel **Preview** `LIBSQL_URL`           |
| `STAGING_LIBSQL_AUTH_TOKEN` | Same value as Vercel **Preview** `LIBSQL_AUTH_TOKEN`    |

```bash
gh secret set PROD_LIBSQL_URL --body "<same value as Vercel Production LIBSQL_URL>"
gh secret set PROD_LIBSQL_AUTH_TOKEN --body "<same value as Vercel Production LIBSQL_AUTH_TOKEN>"
gh secret set STAGING_LIBSQL_URL --body "<same value as Vercel Preview LIBSQL_URL>"
gh secret set STAGING_LIBSQL_AUTH_TOKEN --body "<same value as Vercel Preview LIBSQL_AUTH_TOKEN>"
```

---

## One-time cloud setup (when you're ready to go live)

### 1. Create two Turso databases

**Required before Google login can land on `/dashboard` on Vercel.** Without
`LIBSQL_URL` + `LIBSQL_AUTH_TOKEN`, Auth succeeds but the app falls back to
`file:local.db`, which serverless cannot open (`ConnectionFailed`).

#### Option A — Turso web dashboard (easiest on Windows)

1. Sign up at [turso.tech](https://turso.tech) (GitHub login).
2. Create databases: `catalyst-intel-staging` and `catalyst-intel`.
3. For each DB, copy the **URL** and create a **token**.
4. Continue with migrate + Vercel env vars below.

#### Option B — Turso Cloud CLI (macOS / Linux / WSL)

The cloud management CLI is **not** the same binary as local `tursodb`.
On Windows, use [WSL](https://learn.microsoft.com/windows/wsl/install) then:

```bash
curl -sSfL https://get.tur.so/install.sh | bash
# open a new shell, then:
turso auth signup   # or: turso auth login
turso db create catalyst-intel-staging
turso db create catalyst-intel          # production

turso db show catalyst-intel-staging --url
turso db tokens create catalyst-intel-staging

turso db show catalyst-intel --url
turso db tokens create catalyst-intel
```

You do **not** need to migrate these manually - Vercel's build step runs migrations
automatically (see "Database migrations in CI/CD" below), including the very first one
against a brand-new, empty database. Just add the URL/token to Vercel (next step) and deploy;
if you want to sanity-check a DB before that, `npm run db:migrate` still works standalone:

```bash
LIBSQL_URL="<staging url>" LIBSQL_AUTH_TOKEN="<staging token>" npm run db:migrate
```

### 2. Create a Vercel project

1. [vercel.com](https://vercel.com) → Import `zhbar10/catalyst-intel`.
2. Framework: Next.js (auto-detected).
3. **Settings → Git → Production Branch** = `main`.
4. Deploys for other branches are already restricted by [`vercel.json`](vercel.json) to
   **`dev` and `main` only**.
5. Add the env vars from the tables above. Scope carefully:
   - Staging Turso vars → **Preview**
   - Production Turso vars → **Production**
   - Shared Supabase / SEC vars → **Preview + Production** (or All)

Generate `CRON_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Verify

1. Push / merge into `dev` → Vercel staging deploy + GitHub Actions CI.
2. Promote `dev` → `main` (only when you ask) → Vercel production deploy + CI.
3. Actions → `Fetch catalysts (scheduled ETL)` → **Run workflow** → expect HTTP 200 for each
   environment that has its secrets configured.
4. Sign in with Google on the live URL using an allowlisted admin email (or set
   `ADMIN_EMAILS` on Vercel), open `/admin`, run **Fetch all sources now**, confirm `/dashboard`
   shows multi-source data.

#### Keyless sources checklist (only `SEC_EDGAR_USER_AGENT` required)

After **Fetch all sources now** (or a successful GHA cron run), the admin per-source
breakdown and `raw_sources.provider` counts should include:

| Provider                          | Expected status                     | Notes                                                                                                                                             |
| --------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sec-edgar`                       | `ok` (Form 4 via Atom `type=4`)     | Needs `SEC_EDGAR_USER_AGENT`                                                                                                                      |
| `nasdaq-halts`                    | `ok`                                | No key                                                                                                                                            |
| `macro-calendar`                  | `ok` (CPI / NFP / FOMC)             | No key; embedded BLS + Fed schedule                                                                                                               |
| `openfda`                         | `ok` (recent AP submissions only)   | No key; dates inside 30-day retention                                                                                                             |
| `clinicaltrials`                  | `ok`                                | No key                                                                                                                                            |
| `finnhub`                         | `skipped` without `FINNHUB_API_KEY` | Soft-fail OK                                                                                                                                      |
| `polygon-news` / `polygon-prices` | `skipped` without `POLYGON_API_KEY` | Soft-fail OK. Free tier: ~5 REST req/min; same-day aggs often 403 timeframe — prices enrich prior sessions in small batches and soft-skip 429/403 |
| `form4api`                        | `skipped` without `FORM4_API_KEY`   | EDGAR Form 4 still works via `sec-edgar`                                                                                                          |

On `/dashboard`, Source column should show **SEC EDGAR**, **Nasdaq Halts**, **Macro**, **openFDA**,
and/or **ClinicalTrials** (not only SEC).

## Database migrations in CI/CD

`npm run build` is `drizzle-kit migrate && next build` (see `package.json`) - migrations are
not a separate manual step, they run wherever a build runs:

- **Vercel** builds staging on every push to `dev` and production on every push to `main`
  (`vercel.json` restricts deploys to just those two branches). Each build applies any pending
  migration against that environment's `LIBSQL_URL`/`LIBSQL_AUTH_TOKEN` _before_ `next build`
  compiles the app, so new code and its matching schema always land together, and a broken
  migration fails the build (and the deploy) instead of shipping silently.
- **GitHub Actions CI** (`ci.yml`) also runs `npm run build` on every push/PR, against a
  throwaway SQLite file (`DATABASE_URL: file:./local.db`, recreated per run). This isn't a
  real environment, but it does mean every PR into `dev` verifies its migrations apply
  cleanly - a broken migration SQL file fails CI before it can be merged.
- **GitHub Actions deploy migration** (`migrate.yml`) additionally runs `drizzle-kit migrate`
  directly against the real staging/production Turso DB on every push to `dev`/`main`, as its
  own explicit, visible-in-Actions step (see secrets below). This is redundant with Vercel's
  build-time migration by design - both are safe to run against the same DB - so a migration
  landing is never solely dependent on Vercel's build succeeding.
- **Admin UI** (`/admin` → "Run pending migrations") calls `POST /api/admin/migrate`, which runs
  the same drizzle migrator in-process against whichever DB the running app is pointed at. Use
  this to catch up a schema change immediately without waiting on a deploy or Action to finish.

**Workflow when you change `src/db/schema.ts`:**

1. `npm run db:generate` - writes a new file under `drizzle/`.
2. Commit the generated SQL alongside your schema change.
3. Open the PR as usual. CI applies it against the throwaway DB; merging to `dev` /
   promoting to `main` applies it to staging / production automatically on the next build.

**Known limitation:** two builds hitting the same Turso DB at the exact same moment (e.g. a
rapid double-push) both run `drizzle-kit migrate` independently. This is safe in the common
case - already-applied migrations are skipped - but isn't lock-protected. Not a realistic risk
at this project's push frequency/team size; revisit if that changes.

## Data retention

Catalysts older than 30 days (`RETENTION_DAYS` in `src/lib/jobs/data-retention.ts`) are purged
once at the end of each multi-source orchestrator run (and after standalone SEC fetches).
Purging is keyed off the catalyst's **event timestamp**, not when it was ingested. openFDA only
ingests AP submissions inside that window so they are not immediately deleted. Any raw source
left with no catalyst referencing it is deleted too. `companies` rows are never purged.

## Why Turso (not local SQLite) on Vercel

Vercel serverless has no durable writable filesystem across invocations. Turso is hosted libSQL -
same driver and schema as local SQLite; only the URL/token change.

## Why GitHub Actions cron every 5 minutes

Closest free option to "every 1-2 minutes." Vercel Hobby allows one cron/day; Pro is $20/mo for
per-minute.

**Real-world cadence is worse than the configured interval, not just "occasional drift."**
Pulling actual run history (`gh run list --workflow=fetch-sec-edgar-cron.yml`) shows gaps of
45 minutes to 3.5+ hours between scheduled runs, averaging ~75 minutes, against a configured
`*/5 * * * *`. GitHub throttles/coalesces frequent `schedule` triggers under load far more than
the docs imply — treat this workflow as "best-effort, roughly hourly," not "every 5 minutes."

**Self-healing backstop:** because the scheduler can't be trusted to hit its own interval,
`GET /api/catalysts` checks the most recent ingestion timestamp on every read and fires a
non-blocking multi-source refetch (SEC EDGAR + Nasdaq halts) if the data is stale (>4 min old),
with a 3-minute cooldown and a 10-minute cooldown after a failed attempt
(`src/lib/jobs/ingestion-freshness.ts`). Tightened from the original 10 min / 5 min / 15 min
after confirming via `gh run list --workflow=fetch-sec-edgar-cron.yml` that real gaps between
cron runs are commonly 45 min to 3.5+ hours - this backstop, not the cron schedule, is what
actually keeps the tape near-live day to day. Full multi-source runs remain on GHA cron / Admin
"Fetch all".

**Decision: keep GitHub Actions cron while on Vercel Hobby.** GitHub Actions here is a scheduler
pinging `/api/admin/fetch/all` — it never touches Turso directly, the route handler does.
The ideal end-state is GitHub Actions reserved purely for CI (`ci.yml`) and Vercel's native
`crons` config (in `vercel.json`) driving ETL, since it removes one moving part and Vercel Cron
auto-sends `Authorization: Bearer $CRON_SECRET`, matching the secret this project already uses.
But Vercel Cron on Hobby is capped at once/day with ±59min timing precision — switching now would
regress the scheduled path from ~hourly to once a day. Revisit this the moment the project moves
to Vercel Pro.

## Testing ETL end-to-end

| Where          | How                                                                                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local**      | `npm run cron` (continuous multi-source, every `CRON_INTERVAL_MINUTES`) or `/admin` → "Fetch all sources now" / per-source buttons.                                                                                             |
| **Staging**    | Sign in with an allowlisted admin email on the staging Preview URL → `/admin` → run a fetch; or set `STAGING_APP_URL`/`STAGING_CRON_SECRET` so the scheduled workflow covers it; or `gh workflow run fetch-sec-edgar-cron.yml`. |
| **Production** | Same as staging, against the production URL/secrets, or watch the self-healing backstop kick in on real traffic.                                                                                                                |

To confirm data actually landed, check `/dashboard` (Live feed) or open Drizzle Studio
(`npm run db:studio` locally; point `LIBSQL_URL`/`LIBSQL_AUTH_TOKEN` at a remote Turso DB to
inspect staging/production the same way).

## Logging & monitoring plan

Goal: know about production failures without watching Vercel logs all day.

### What ships in-app today

| Signal                       | Where                                                 | How you see it                          |
| ---------------------------- | ----------------------------------------------------- | --------------------------------------- |
| Server request crashes       | `src/instrumentation.ts` → PostHog `captureException` | PostHog → Error tracking / `$exception` |
| Client React error boundary  | `src/app/error.tsx` → PostHog `captureException`      | Same                                    |
| Ingest enrichment soft-fails | `fetch-all-sources.ts` → `reportServerError`          | PostHog + Vercel function logs          |
| Ingest audit trail           | `ingestion_runs` + Admin panel                        | `/admin`                                |
| Cron HTTP failures           | GHA `fetch-sec-edgar-cron.yml` exits non-zero         | GitHub Actions email / UI               |
| Liveness probe               | `GET /api/health`                                     | Uptime monitor (see below)              |
| Product analytics            | PostHog pageviews / custom events                     | PostHog insights                        |

Vercel Runtime Logs remain the source of truth for raw `console.error` output.

### Ops checklist (do once per environment)

1. **PostHog** — set `NEXT_PUBLIC_POSTHOG_KEY` (+ host) on Preview and Production. In PostHog, enable **Error tracking** and create an alert (Slack/email) for exception spikes.
2. **Uptime** — point UptimeRobot / Better Stack / Checkly at `https://<host>/api/health` every 1–5 minutes; alert on non-200.
3. **GitHub Actions** — ensure repo notification settings email you on failed workflow runs for `Fetch catalysts (scheduled ETL)`.
4. **Vercel** — enable deployment failure notifications for the project.
5. **Cron secret** — treat `CRON_SECRET` like root access (rotate if leaked); it bypasses admin session checks by design.

### Later upgrades (not required for MVP)

- Dedicated APM (Sentry) if PostHog exception volume/noise becomes painful.
- Shared rate-limit store (Upstash Redis) once multiple serverless isolates matter.
- Slack webhook from Admin when an `ingestion_runs` row ends with high `errors`.
