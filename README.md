# Catalyst Intel

Real-time market catalyst intelligence: detects, stores, and (soon) scores events that can move
publicly traded stocks - built for active traders and independent analysts.

See [ARCHITECTURE.md](ARCHITECTURE.md) for a diagram and TL;DR of how the pieces fit together.

This is the first working slice of the platform: a local-first Next.js app with SEC EDGAR
filings flowing into a dashboard, gated behind Supabase-backed auth.

## Stack (this phase)

- **Next.js 16 + TypeScript** (App Router), **Tailwind CSS**, **shadcn/ui** (dark theme default)
- **SQLite-compatible (libSQL) via Drizzle ORM** for all app data - companies, catalysts, raw
  sources, local users. Locally this is a plain file (`local.db`); in production it's a hosted
  Turso database - same driver, same schema, no code changes (see [DEPLOYMENT.md](DEPLOYMENT.md))
- **Supabase Cloud** for Auth only (its own Postgres database is _not_ used for app data)
- **PostHog** for optional product analytics (pageviews + autocapture when configured)
- **SEC EDGAR** (free, no API key) as the first data vendor
- AI classification/scoring (Groq hosting Qwen3-32B) is planned for a later phase - not wired up yet

## One-time setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a free Supabase project (for Auth) and enable Google sign-in

1. Go to [supabase.com](https://supabase.com) and create a new project (free tier).
2. In **Authentication → URL Configuration**:
   - **Site URL** (production): `https://catalyst-intel-rouge.vercel.app`
   - **Redirect URLs** (add all that you use):
     - `http://localhost:3000/auth/callback`
     - `https://catalyst-intel-rouge.vercel.app/auth/callback`
     - any Vercel preview URL callback you need, e.g.
       `https://<preview>.vercel.app/auth/callback`
3. In **Authentication → Providers**, enable **Google** (this is the _only_ sign-in method - no
   passwords are ever collected or stored by this app). Follow Supabase's
   [Google OAuth guide](https://supabase.com/docs/guides/auth/social-login/auth-google):
   - Create a Google Cloud **OAuth client ID** (Web application)
   - Authorized JavaScript origins: `http://localhost:3000` and
     `https://catalyst-intel-rouge.vercel.app`
   - Authorized redirect URI: the value Supabase shows on the Google provider page
     (`https://<your-project-ref>.supabase.co/auth/v1/callback`)
   - Paste the Client ID and Client Secret into Supabase → Save
4. In **Project Settings → API**, copy the **Project URL** and **anon public** key into `.env.local`.
   Restart `npm run dev` after changing env vars.

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the Supabase values:

```bash
cp .env.example .env.local
```

| Variable                        | Required now?         | Notes                                                                                  |
| ------------------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | Yes (default is fine) | Local SQLite file path                                                                 |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes                   | From Supabase Project Settings -> API                                                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes                   | From Supabase Project Settings -> API                                                  |
| `SEC_EDGAR_USER_AGENT`          | Yes                   | SEC requires a descriptive contact string, e.g. `you@email.com CatalystIntel/0.1`      |
| `NEXT_PUBLIC_POSTHOG_KEY`       | No                    | PostHog Project API key (`phc_…`). Leave blank to disable analytics                    |
| `NEXT_PUBLIC_POSTHOG_HOST`      | No                    | Default `https://us.i.posthog.com` (use `https://eu.i.posthog.com` for EU)             |
| `ADMIN_EMAILS`                  | No                    | Comma-separated admin emails; defaults to `zhbar10@gmail.com,omer.nachshon@gmail.com`  |
| `SUPABASE_SERVICE_ROLE_KEY`     | No                    | Reserved for future admin operations                                                   |
| `OPENROUTER_API_KEY`            | No                    | On-demand AI analysis (free `:free` models). Or use `OPENROUTER_API_KEYS` (comma pool) |

No SEC/FDA/ClinicalTrials.gov API keys are needed - those vendors are free and keyless.

### PostHog analytics (optional)

1. Create a free project at [posthog.com](https://posthog.com) (pick US or EU Cloud).
2. Open **Project settings** and copy the **Project API key** (`phc_…`).
3. Locally, add to `.env.local` (then restart `npm run dev`):

   ```bash
   NEXT_PUBLIC_POSTHOG_KEY=phc_your_key_here
   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
   ```

   For EU Cloud, use `https://eu.i.posthog.com` instead.

4. On Vercel: **Project → Settings → Environment Variables** — set the same two vars for
   Preview (`dev` / staging) and Production (`main`). Redeploy after saving.

If `NEXT_PUBLIC_POSTHOG_KEY` is missing, PostHog stays off and the app runs normally.

### On-demand AI analysis (optional, OpenRouter free)

1. Create an API key at [openrouter.ai/keys](https://openrouter.ai/keys) (no card required for `:free` models).
2. Add to `.env.local` and restart `npm run dev`:

   ```bash
   OPENROUTER_API_KEY=sk-or-v1-your-key
   # optional pool for more free quota:
   # OPENROUTER_API_KEYS=sk-or-v1-aaa,sk-or-v1-bbb
   ```

3. On Vercel, set the same var(s) for Preview + Production.

Default model: `openai/gpt-oss-20b:free`. Analysis runs only when a user
clicks **See AI analysis**; the result is stored on the catalyst and shared for everyone.

**Quota tips (still free-tier friendly):** stack multiple OpenRouter accounts via
`OPENROUTER_API_KEYS` (round-robin + 429 failover), and/or add a one-time **$10 credit**
on OpenRouter — that typically raises free-model daily limits from ~50 to ~1000 while
you keep using `:free` models (you are not billed per token on those models).

### 4. Set up the local database

```bash
npm run db:migrate
```

This creates `local.db` with the `users`, `companies`, `raw_sources`, and `catalysts` tables.

### 5. Run the app

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

### 6. Create an account (admin is email-allowlisted)

1. Go to `/login` and click **Continue with Google** - this creates your account automatically
   (no separate signup step, no password).
2. That first sign-in creates your row in the local `users` table and syncs `role` from the
   admin email allowlist (`ADMIN_EMAILS` or the defaults in `src/lib/auth/admin.ts`).
3. Only allowlisted emails can open `/admin` or trigger the manual fetch API. Everyone else
   lands on the Live feed (`/catalyst-feed`) after login.

### 7. Populate real data

Sign in as an allowlisted admin, go to `/admin`, and click **"Fetch SEC EDGAR now"**. This pulls
the latest 8-K filings from SEC EDGAR's free feed, resolves symbols where possible, and stores
them. Then check `/catalyst-feed` (Live) to see them listed.

### 8. (Optional) Keep data flowing continuously while developing

Instead of manually clicking the admin button, run the local cron in its own terminal:

```bash
npm run cron
```

This fetches immediately, then re-fetches every `CRON_INTERVAL_MINUTES` (default `1`). Leave it
running while you develop and `/catalyst-feed` stays up to date. Stop with `Ctrl+C`.

**Production:** ETL is driven by [cron-job.org](https://cron-job.org) (job title e.g.
`catalyst-intel prod ETL`) every **1 minute**, POSTing
`https://<host>/api/admin/fetch/all` with the `x-cron-secret` header. See
[ARCHITECTURE.md](ARCHITECTURE.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

## Staging & production

Local machines always use SQLite (`DATABASE_URL=file:./local.db`). Staging is the `dev` branch on
Vercel; production is `main`. Env vars for each environment (and CI/CD triggers) are documented in
[DEPLOYMENT.md](DEPLOYMENT.md).

## Useful scripts

| Command                         | Purpose                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev`                   | Start the dev server                                                                          |
| `npm run build`                 | Applies pending migrations, then production build (see `DEPLOYMENT.md`)                       |
| `npm run db:generate`           | Generate a new Drizzle migration after changing `src/db/schema.ts`                            |
| `npm run db:migrate`            | Apply pending migrations to `local.db`                                                        |
| `npm run db:studio`             | Open Drizzle Studio to browse `local.db`                                                      |
| `npm run make-admin -- <email>` | Deprecated helper — syncs local `users.role` from the allowlist (does not grant access alone) |
| `npm run cron`                  | Continuously re-fetch all sources every `CRON_INTERVAL_MINUTES` (default 1; local)            |

## Architecture notes

- **libSQL (SQLite-compatible) holds all app data**, via `@libsql/client` + `drizzle-orm/libsql`.
  Locally it opens a plain file; in production it points at a hosted Turso database instead - no
  driver or schema changes needed, just different env vars (`LIBSQL_URL`/`LIBSQL_AUTH_TOKEN`).
  Supabase Cloud is used only for Auth; its Postgres database is not touched by the app.
- **`src/proxy.ts`** (Next.js 16's replacement for `middleware.ts`) refreshes the Supabase session
  cookie and does a cheap, optimistic redirect for signed-out visitors. Real authorization lives
  in page/API handlers: session via `getCurrentAppUser()`, admin via JWT email allowlist
  (`src/lib/auth/admin.ts`).
- **Data ingestion** can be triggered several ways, all calling
  `fetchAllCatalystSources()` via `/api/admin/fetch/all` (or the shared job modules):
  the `/admin` page button (allowlisted session), `npm run cron` (local, continuous),
  **cron-job.org every 1 minute in production** (`x-cron-secret`), or a self-healing background
  trigger on `GET /api/catalysts` when data
  looks stale (`src/lib/jobs/ingestion-freshness.ts`) — see [DEPLOYMENT.md](DEPLOYMENT.md) and
  [ARCHITECTURE.md](ARCHITECTURE.md).
- **Per-vendor watermarks** (`vendor_fetch_state`): each source keeps its own `last_fetched_at`.
  After a Polygon HTTP 429 the cursor does **not** advance, so the next tick widens the news
  window / price enrich batch and does not permanently miss results — see [FETCH-ORDER.md](FETCH-ORDER.md).
- **IA:** `/` is marketing for signed-out users (signed-in users redirect to Live). `/catalyst-feed`
  is the Live feed (old `/dashboard` links 308-redirect here); `/profile` is account + sign-out.
- **Live presence:** while the Live tab is visible/focused, the client soft-refetches
  `GET /api/catalysts` on an interval (no full page reload). Hidden tabs pause; unfocused
  but visible tabs poll more slowly.
- **Rate limits:** per-IP in-memory windows on API routes (`src/lib/http/rate-limit.ts`).
  Cron with `x-cron-secret` bypasses the admin write limit.
- **`src/lib/jobs/fetch-sec-edgar.ts`** dedupes by SEC accession number, so re-running the fetch is
  always safe.
- **Data retention:** catalysts older than 30 days (by filing timestamp, not ingestion time) are
  purged at the end of every fetch run, along with any now-orphaned raw source
  (`src/lib/jobs/data-retention.ts`). Companies are kept indefinitely (small reference data).

## What's next (not in this pass)

- AI classification/scoring/summarization via Groq (Qwen3-32B)
- Watchlists and alerts
- Deciding if/when to migrate app data to Supabase Postgres instead of Turso
