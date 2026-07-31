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
- **Primary CD — CI Vercel deploy** (same `ci.yml`, `deploy` job after a green
  `test-and-build`): on push to `main` runs `vercel deploy --prod`; on push to
  `dev` runs `vercel deploy` (preview) and aliases to the stable staging host
  `catalyst-intel-git-dev-zhbar10s-projects.vercel.app`. Uses repo secrets
  `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` (soft-skip with
  `::warning::` if unset — same pattern as the unblock workflow). This is the
  reliable path when Vercel’s git-author checks would **Block** a deploy.
- **Vercel Git integration** (`vercel.json`): still may deploy on push to `dev` /
  `main` (and matching feature-branch globs). Treat it as secondary; CI CLI
  deploy is authoritative for staging/production tip.
- **Backup — Unblock Omer CD heal** (`.github/workflows/vercel-unblock-redeploy.yml`):
  after a **successful CI on `main`** (verify + deploy), waits **1 minute** then
  heals blocked/failed Omer Production deploys; also polls every 10 minutes as a
  safety net (see below).
- **Scheduled ETL (production):** [cron-job.org](https://cron-job.org) POSTs
  `/api/admin/fetch/all` every **1 minute** with `x-cron-secret`. See "Production scheduler"
  below for setup and the in-app self-healing backstop.

## Env vars cheat sheet

### Local (`.env.local` on your machine)

| Variable                               | Required? | Notes                                                                                                                          |
| -------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                         | Yes       | `file:./local.db` (default is fine)                                                                                            |
| `NEXT_PUBLIC_SUPABASE_URL`             | Yes       | Supabase Project Settings → API                                                                                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | Yes       | Supabase Project Settings → API                                                                                                |
| `SEC_EDGAR_USER_AGENT`                 | Yes       | e.g. `you@email.com CatalystIntel/0.1`                                                                                         |
| `CRON_INTERVAL_MINUTES`                | No        | Default `1` for `npm run cron`                                                                                                 |
| `NEXT_PUBLIC_POSTHOG_KEY`              | No        | PostHog Project API key; omit to disable analytics                                                                             |
| `NEXT_PUBLIC_POSTHOG_HOST`             | No        | Default `https://us.i.posthog.com`                                                                                             |
| `ADMIN_EMAILS`                         | No        | Comma-separated admin emails; defaults to `zhbar10@gmail.com,omer.nachshon@gmail.com`                                          |
| `FINNHUB_API_KEY`                      | No        | Finnhub: NYSE listings, earnings/FDA calendars, news (soft-fail)                                                               |
| `FMP_API_KEY`                          | No        | FMP economic calendar (soft-fail; often premium — 402 skipped). Dedicated ~10m cron, not 1-min fetch/all                       |
| `PR_WIRE_API_KEY` / `PR_WIRE_API_BASE` | No        | Optional. PR wire scrapes a **free public high-impact board** with no key; set these only for the authenticated full firehose. |
| `POLYGON_API_KEY`                      | No        | Polygon/Massive news + historical_impact enrichment (soft-fail; free tier ~5 req/min, no same-day aggs)                        |
| `MASSIVE_API_KEY`                      | No        | Alias for `POLYGON_API_KEY`                                                                                                    |
| `FORM4_API_KEY`                        | No        | Optional Form4API enrichment (EDGAR Form 4 still works without it)                                                             |
| `LIBSQL_URL` / `LIBSQL_AUTH_TOKEN`     | No        | Leave unset locally - use the SQLite file                                                                                      |
| `CRON_SECRET`                          | No        | Only needed for remote cron callers                                                                                            |

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
via `/admin` uses the same allowlist; cron-job.org uses `x-cron-secret`.

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

| Route                                        | Default          | Notes                                            |
| -------------------------------------------- | ---------------- | ------------------------------------------------ |
| `GET /api/catalysts`                         | 90 / minute / IP | Live feed soft-refetch                           |
| `POST /api/admin/fetch/all` (session)        | 6 / minute / IP  | Admin multi-source orchestrator                  |
| `POST /api/admin/fetch/[source]` (session)   | 6 / minute / IP  | Per-source admin trigger                         |
| `POST /api/admin/fetch/sec-edgar` (session)  | 6 / minute / IP  | Legacy SEC-only trigger (still works)            |
| Same admin routes with valid `x-cron-secret` | **bypassed**     | Production cron (cron-job.org) must keep working |

Responses that exceed the limit return **429** with `Retry-After` and `X-RateLimit-*`
headers. This store is **per Vercel isolate** — fine for MVP spam protection; shared Redis
(e.g. Upstash) would be needed later for strict multi-instance global limits. No Upstash
env vars are required today.

### Staging (Vercel → Environment: **Preview**, used by the `dev` branch)

| Variable                               | Required?   | Notes                                                            |
| -------------------------------------- | ----------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Yes         | Same Supabase project is fine for MVP                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | Yes         | Same as local                                                    |
| `SEC_EDGAR_USER_AGENT`                 | Yes         | Same contact string is fine                                      |
| `LIBSQL_URL`                           | Yes         | Turso **staging** DB URL                                         |
| `LIBSQL_AUTH_TOKEN`                    | Yes         | Turso **staging** DB token                                       |
| `NEXT_PUBLIC_POSTHOG_KEY`              | Recommended | Same PostHog project is fine for MVP                             |
| `NEXT_PUBLIC_POSTHOG_HOST`             | Recommended | `https://us.i.posthog.com` or EU host                            |
| `ADMIN_EMAILS`                         | No          | Override admin allowlist if needed (same defaults as local)      |
| `CRON_SECRET`                          | Recommended | So you can manually trigger fetch against staging                |
| `FINNHUB_API_KEY`                      | No          | Enables Finnhub catalysts + NYSE listings (Admin / cron)         |
| `PR_WIRE_API_KEY` / `PR_WIRE_API_BASE` | No          | Optional full-feed upgrade; public PR wire scrape needs no key   |
| `POLYGON_API_KEY`                      | No          | Enables Polygon/Benzinga news + price enrichment                 |
| `FORM4_API_KEY`                        | No          | Optional Form4API enrichment                                     |
| `RESEND_API_KEY`                       | No          | Enables email alert delivery + feedback emails                   |
| `RESEND_FROM_EMAIL`                    | No          | Optional From for Resend (defaults to onboarding sender)         |
| `FEEDBACK_TO_EMAIL`                    | No          | Feedback inbox (defaults to `catalyst.intel.feedback@gmail.com`) |
| `OPENROUTER_API_KEY`                   | No          | On-demand AI analysis (or `OPENROUTER_API_KEYS` comma pool)      |

### Production (Vercel → Environment: **Production**, used by `main`)

| Variable                               | Required?   | Notes                                                            |
| -------------------------------------- | ----------- | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Yes         | Same Supabase project is fine for MVP                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | Yes         | Same as local/staging                                            |
| `SEC_EDGAR_USER_AGENT`                 | Yes         | Same contact string is fine                                      |
| `LIBSQL_URL`                           | Yes         | Turso **production** DB URL (separate DB)                        |
| `LIBSQL_AUTH_TOKEN`                    | Yes         | Turso **production** DB token                                    |
| `NEXT_PUBLIC_POSTHOG_KEY`              | Recommended | Same PostHog project is fine for MVP                             |
| `NEXT_PUBLIC_POSTHOG_HOST`             | Recommended | `https://us.i.posthog.com` or EU host                            |
| `ADMIN_EMAILS`                         | No          | Override admin allowlist if needed (same defaults as local)      |
| `CRON_SECRET`                          | Yes         | Must match the value configured in cron-job.org                  |
| `FINNHUB_API_KEY`                      | No          | Enables Finnhub catalysts + NYSE listings (Admin / cron)         |
| `PR_WIRE_API_KEY` / `PR_WIRE_API_BASE` | No          | Optional full-feed upgrade; public PR wire scrape needs no key   |
| `POLYGON_API_KEY`                      | No          | Enables Polygon/Benzinga news + price enrichment                 |
| `FORM4_API_KEY`                        | No          | Optional Form4API enrichment                                     |
| `RESEND_API_KEY`                       | No          | Enables email alert delivery + feedback emails                   |
| `RESEND_FROM_EMAIL`                    | No          | Optional From for Resend                                         |
| `FEEDBACK_TO_EMAIL`                    | No          | Feedback inbox (defaults to `catalyst.intel.feedback@gmail.com`) |
| `OPENROUTER_API_KEY`                   | No          | On-demand AI analysis (or `OPENROUTER_API_KEYS` comma pool)      |

### GitHub repo secrets (for the deploy migration workflow)

`migrate.yml` runs `npm run db:migrate` from GitHub Actions on every push to `main` /
`dev`, as an explicit, visible-in-Actions step in addition to the migration Vercel's own
build already runs. Missing secrets skip that push's job (logs a `::warning::`, exits 0)
instead of failing the workflow - Vercel's build-time migration still applies either way.
**As of 2026-07-26 these secrets are not set in this repo**, so `migrate.yml` has never
actually touched the real staging/production DB - Vercel's build-time migration is
currently the _only_ thing migrating those environments. Set the secrets below to make
`migrate.yml` a real fallback.

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

### Auto-heal Omer / access-blocked Vercel deploys (GitHub Actions CD)

**Primary path:** after CI is green, `ci.yml`’s `deploy` job already ships
`dev`/`main` via the Vercel CLI with the team token, so author **Blocked**
git deploys should not stall staging or production.

**CD heal (post-merge to `main`):** `.github/workflows/vercel-unblock-redeploy.yml`
listens for a **successful `CI` `workflow_run` on `main`** (tests + deploy
finished). It is **not** a job inside `ci.yml`. On that trigger it:

1. Waits **60 seconds** after the CI/CD run completes
2. Runs `scripts/vercel-unblock-redeploy.mjs` to heal any leftover
   **BLOCKED** / access-failed Production deploy for Omer commits

**Backup poll:** the same workflow still runs every **10 minutes** on schedule,
and on **Actions → Unblock Omer Vercel deploys → Run workflow**.

Vercel can still **Block** or **fail** a git-triggered deploy when:

- the commit author is not a recognized team member (common for
  `omer.nachshon` / `OmerNachshon` / `omer.nachshon@…` while only the Vercel
  owner seat is linked), or
- GitHub App / private-repo / permission / unauthorized access rejects the push

Heals cover **`main` → Production** and **`dev` → Preview**
(`catalyst-intel-git-dev-zhbar10s-projects.vercel.app`) when a blocked git
deploy was left behind.

**Author match rules** (case-insensitive): commit author name, login, email, or
actor matching `omer.nachshon`, `Omer Nachshon`, `OmerNachshon`, or `nachshon`.

**What triggers a heal**

| State     | Condition                                                       |
| --------- | --------------------------------------------------------------- |
| `BLOCKED` | Author matches Omer **or** access/seat wording                  |
| `ERROR`   | Author matches Omer (access wording preferred but not required) |

Only `main` / Production and `dev` Preview are healed (feature branches ignored).

**Redeploy fallback chain** (team `VERCEL_TOKEN` — this is how CD “allows” the
deploy when git integration rejects the author):

1. API redeploy same SHA (token owner approves the blocked commit)
2. API redeploy with `withLatestCommit` (branch tip)
3. API create from `gitSource` branch tip
4. **CLI file-upload** `vercel deploy` from checked-out tip (bypasses git-author
   / GitHub App seat checks when API paths still fail)

Idempotent: skips if a newer healthy (`READY` / building) deploy already exists
for the same commit SHA or the same branch after the failure.

**Required GitHub Actions secrets** (shared by CI `deploy` and the unblock
CD workflow — repo → Settings → Secrets and variables → Actions):

| Secret              | Notes                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `VERCEL_TOKEN`      | Create at [vercel.com/account/tokens](https://vercel.com/account/tokens) (team-owner token recommended) |
| `VERCEL_ORG_ID`     | Team id from `.vercel/project.json` → `orgId` (`team_IvSJt6AmTC91h24fmVeLHfDI`)                         |
| `VERCEL_PROJECT_ID` | Project id from `.vercel/project.json` → `projectId` (`prj_bzkyprBR2Hl8TbqadquO1z0L23On`)               |

```bash
gh secret set VERCEL_TOKEN --body "<token from vercel.com/account/tokens>"
gh secret set VERCEL_ORG_ID --body "team_IvSJt6AmTC91h24fmVeLHfDI"
gh secret set VERCEL_PROJECT_ID --body "prj_bzkyprBR2Hl8TbqadquO1z0L23On"
```

If those secrets are missing, CI deploy and the unblock job each log a warning
and exit 0 (same soft-fail pattern as `migrate.yml`). The unblock **schedule
and `workflow_run` only run from the default branch (`main`)** — that workflow
must be on `main` for post-merge CD heal + cron to be live; until then use
**workflow_dispatch**. CI deploy runs from whichever branch was pushed (`dev`
or `main`) once the workflow file is on that branch.

Manual one-off (local, with env set):

```bash
VERCEL_TOKEN=… VERCEL_ORG_ID=… VERCEL_PROJECT_ID=… node scripts/vercel-unblock-redeploy.mjs
```

**Optional Cursor Automation (complement, not required):** you can add a
scheduled Cursor agent that every ~15 minutes runs
`node scripts/vercel-unblock-redeploy.mjs` with the same three env vars. CI
CLI deploy is primary; the GitHub unblock Action is the CD heal + always-on
backup; a Cursor Automation is only useful if Actions secrets are unset.

---

## One-time cloud setup (when you're ready to go live)

### 1. Create two Turso databases

**Required before Google login can land on `/catalyst-feed` on Vercel.** Without
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

1. Push / merge into `dev` → GitHub Actions CI (verify + CLI staging deploy).
2. Promote `dev` → `main` (only when you ask) → GitHub Actions CI (verify + CLI production deploy).
3. Confirm cron-job.org (or `/admin` → **Fetch all sources now**) returns HTTP 200 against
   production.
4. Sign in with Google on the live URL using an allowlisted admin email (or set
   `ADMIN_EMAILS` on Vercel), open `/admin`, run **Fetch all sources now**, confirm `/catalyst-feed`
   shows multi-source data.

#### Keyless sources checklist (only `SEC_EDGAR_USER_AGENT` required)

After **Fetch all sources now** (or a successful cron-job.org run), the admin per-source
breakdown and `raw_sources.provider` counts should include:

| Provider            | Expected status                     | Notes                                                                                                                                                                                                                                                           |
| ------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sec-edgar`         | `ok` (Form 4 via Atom `type=4`)     | Needs `SEC_EDGAR_USER_AGENT`                                                                                                                                                                                                                                    |
| `nasdaq-halts`      | `ok`                                | No key                                                                                                                                                                                                                                                          |
| `macro-calendar`    | `ok` (CPI / NFP / FOMC)             | No key; embedded BLS + Fed schedule                                                                                                                                                                                                                             |
| `fmp-econ-calendar` | `ok` / `skipped`                    | Needs `FMP_API_KEY`; dedicated ~10m cron (not 1-min fetch/all). Soft-skip on 402. Desk rail prefers FMP when rows exist.                                                                                                                                        |
| `openfda`           | `ok` (recent AP submissions only)   | No key; dates inside 30-day retention                                                                                                                                                                                                                           |
| `clinicaltrials`    | `skipped` (paused)                  | Not fetched — daily lag; code kept (`fetchEnabled: false`)                                                                                                                                                                                                      |
| `pr-wire`           | always runs (keyless public board)  | Free public impact scrape by default (newest-first; ~60m delay; upstream score≥70 floor). No article URLs on free receipts — Details uses structured extract. Optional auth full feed + `/a/{id}` body scrape via env. Label **PR Wire**; favored on duplicates |
| `finnhub`           | `skipped` without `FINNHUB_API_KEY` | Soft-fail OK                                                                                                                                                                                                                                                    |
| `polygon-news`      | `skipped` (paused)                  | Not fetched — hourly ticker news; code kept                                                                                                                                                                                                                     |
| `polygon-prices`    | `skipped` without `POLYGON_API_KEY` | Soft-fail OK. Free tier: ~5 REST req/min; same-day aggs often 403 timeframe                                                                                                                                                                                     |
| `form4api`          | `skipped` without `FORM4_API_KEY`   | EDGAR Form 4 still works via `sec-edgar`                                                                                                                                                                                                                        |

On `/catalyst-feed`, Source column should show **SEC EDGAR**, **Nasdaq Halts**, **Macro**, **PR Wire**, **openFDA**,
and/or **ClinicalTrials** (not only SEC).

## Database migrations in CI/CD

`npm run build` is `node scripts/migrate.mjs && next build` (see `package.json`) - migrations
are not a separate manual step, they run wherever a build runs:

- **Vercel** builds staging on every push to `dev` and production on every push to `main`
  (`vercel.json` restricts deploys to just those two branches). Each build applies any pending
  migration against that environment's `LIBSQL_URL`/`LIBSQL_AUTH_TOKEN` _before_ `next build`
  compiles the app, so new code and its matching schema always land together, and a broken
  migration fails the build (and the deploy) instead of shipping silently.
- **GitHub Actions CI** (`ci.yml`) also runs `npm run build` on every push/PR, against a
  throwaway SQLite file (`DATABASE_URL: file:./local.db`, recreated per run). This isn't a
  real environment, but it does mean every PR into `dev` verifies its migrations apply
  cleanly - a broken migration SQL file fails CI before it can be merged.
- **GitHub Actions deploy migration** (`migrate.yml`) additionally runs `npm run db:migrate`
  directly against the real staging/production Turso DB on every push to `dev`/`main`, as its
  own explicit, visible-in-Actions step (see secrets below). This is redundant with Vercel's
  build-time migration by design - both are safe to run against the same DB - so a migration
  landing is never solely dependent on Vercel's build succeeding. **Currently a no-op** until
  the `PROD_*`/`STAGING_*` secrets are set (see above).
- **Admin UI** (`/admin` → "Run pending migrations") calls `POST /api/admin/migrate`, which runs
  the same drizzle migrator in-process against whichever DB the running app is pointed at. Use
  this to catch up a schema change immediately without waiting on a deploy or Action to finish.

### Why `scripts/migrate.mjs` instead of the `drizzle-kit migrate` CLI

`npm run build` and `npm run db:migrate` call `node scripts/migrate.mjs` (a thin wrapper around
drizzle-orm's programmatic `migrate()`) instead of running the `drizzle-kit migrate` CLI
directly. The CLI's progress spinner (`[spinner] applying migrations...`) redraws its terminal
line with carriage returns, which can clobber its own `console.error` output in a non-TTY build
log. On 2026-07-26 this caused a production deploy (PR #246) to fail with only

```
Reading config file '/vercel/path0/drizzle.config.ts'
Error: Command "npm run build" exited with 1
[spinner] applying migrations...
```

in the Vercel build log - no indication of the actual underlying error. `scripts/migrate.mjs`
prints a normal error/stack trace on failure and adds a 60s timeout so a stuck
connection/lock/statement fails fast with a clear message instead of hanging until Vercel's
overall build timeout. If a build fails on this step again, the real cause should now be
visible in the log.

### Turso `BLOCKED` (plan quota exceeded)

If Vercel logs or the desk error page mention **BLOCKED** / "SQL read operations are
forbidden" / "upgrade your plan", the Turso database has hit its monthly row-read (or
row-write / storage) quota. Every SQL query fails until you **upgrade the Turso plan** or
wait for the calendar-month quota to reset — see
[Turso usage and billing](https://docs.turso.tech/help/usage-and-billing).

- Reloading the app will not help; env vars are fine.
- On Vercel, `scripts/migrate.mjs` **skips migrate with a warning** when it sees BLOCKED so
  app deploys are not stuck behind an unfixable migrate. Runtime queries still fail until
  the quota is restored.
- The desk error UI shows **Database quota exceeded** (not the generic "Something went
  wrong") once that copy is deployed.

**Workflow when you change `src/db/schema.ts`:**

1. `npm run db:generate` - writes a new file under `drizzle/`.
2. Commit the generated SQL alongside your schema change.
3. Open the PR as usual. CI applies it against the throwaway DB; merging to `dev` /
   promoting to `main` applies it to staging / production automatically on the next build.

**Known limitation:** two builds hitting the same Turso DB at the exact same moment (e.g. a
rapid double-push) both run the migrator independently. This is safe in the common case -
already-applied migrations are skipped - but isn't lock-protected. Not a realistic risk at this
project's push frequency/team size; revisit if that changes.

## Data retention

Catalysts older than 30 days (`RETENTION_DAYS` in `src/lib/jobs/data-retention.ts`) are purged
once at the end of each multi-source orchestrator run (and after standalone SEC fetches).
Purging is keyed off the catalyst's **event timestamp**, not when it was ingested. openFDA only
ingests AP submissions inside that window so they are not immediately deleted. Any raw source
left with no catalyst referencing it is deleted too. `companies` rows are never purged.

## Why Turso (not local SQLite) on Vercel

Vercel serverless has no durable writable filesystem across invocations. Turso is hosted libSQL -
same driver and schema as local SQLite; only the URL/token change.

## Production scheduler: cron-job.org (every 1 minute)

**Sole prod ETL clock** is [cron-job.org](https://cron-job.org) (example title:
`catalyst-intel prod ETL`) that POSTs:

`https://catalyst-intel.vercel.app/api/admin/fetch/all`

with header `x-cron-secret: <CRON_SECRET>` every **1 minute** (`* * * * *`).

Vercel Hobby allows one cron/day only; external cron-job.org gives reliable 1-min cadence without
Vercel Pro. See [ARCHITECTURE.md](ARCHITECTURE.md).

**Optional FMP economic calendar (every 10 minutes):** add a second cron-job.org job that POSTs
`/api/admin/fetch/fmp-econ-calendar` with the same `x-cron-secret` on `*/10 * * * *`. Requires
`FMP_API_KEY` on Vercel. Kept off the 1-min `fetch/all` path so a free-tier key (~250/day) lasts.
Local: `npm run cron:fmp-econ`. Soft-skips when the key is missing or FMP returns HTTP 402
(econ calendar often premium-gated). Desk calendar prefers FMP rows when present; otherwise the
embedded keyless schedule.

Polygon free-tier (~5 REST req/min) will still hit **429** under a 1-min full orchestrator. The
app holds per-vendor `last_fetched_at` on rate-limit so the **next** tick widens the news window
and price enrich batch instead of permanently missing data — see [FETCH-ORDER.md](FETCH-ORDER.md).

**Self-healing backstop:** `GET /api/catalysts` checks the most recent ingestion timestamp on
every read and fires a non-blocking multi-source refetch if data is stale (>4 min old), with a
3-minute cooldown and a 10-minute cooldown after a failed attempt
(`src/lib/jobs/ingestion-freshness.ts`). This covers scheduler gaps whenever there is real
traffic. Full multi-source runs remain on cron-job.org / Admin "Fetch all".

## Testing ETL end-to-end

| Where          | How                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local**      | `npm run cron` (continuous multi-source, every `CRON_INTERVAL_MINUTES`, default 1) or `/admin` → "Fetch all sources now" / per-source buttons. |
| **Staging**    | Sign in with an allowlisted admin email on the staging Preview URL → `/admin` → run a fetch; or point a cron-job.org job at the staging URL.   |
| **Production** | **cron-job.org** every 1 min → `/api/admin/fetch/all` + `x-cron-secret`; or watch the self-healing backstop kick in on real traffic.           |

To confirm data actually landed, check `/catalyst-feed` (Live feed) or open Drizzle Studio
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
| Cron HTTP failures           | cron-job.org job history / failure notifications      | cron-job.org dashboard                  |
| Liveness probe               | `GET /api/health`                                     | Uptime monitor (see below)              |
| Product analytics            | PostHog pageviews / custom events                     | PostHog insights                        |

Vercel Runtime Logs remain the source of truth for raw `console.error` output.

### Ops checklist (do once per environment)

1. **PostHog** — set `NEXT_PUBLIC_POSTHOG_KEY` (+ host) on Preview and Production. In PostHog, enable **Error tracking** and create an alert (Slack/email) for exception spikes.
2. **Uptime** — point UptimeRobot / Better Stack / Checkly at `https://<host>/api/health` every 1–5 minutes; alert on non-200.
3. **GitHub Actions** — ensure repo notification settings email you on failed workflow runs for CI and migrations (`ci.yml`, `migrate.yml`).
4. **Vercel** — enable deployment failure notifications for the project.
5. **Cron secret** — treat `CRON_SECRET` like root access (rotate if leaked); it bypasses admin session checks by design.

### Later upgrades (not required for MVP)

- Dedicated APM (Sentry) if PostHog exception volume/noise becomes painful.
- Shared rate-limit store (Upstash Redis) once multiple serverless isolates matter.
- Slack webhook from Admin when an `ingestion_runs` row ends with high `errors`.
