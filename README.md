# Catalyst Intel

Real-time market catalyst intelligence: detects, stores, and (soon) scores events that can move
publicly traded stocks - built for active traders and independent analysts.

This is the first working slice of the platform: a local-first Next.js app with SEC EDGAR
filings flowing into a dashboard, gated behind Supabase-backed auth.

## Stack (this phase)

- **Next.js 16 + TypeScript** (App Router), **Tailwind CSS**, **shadcn/ui** (dark theme default)
- **SQLite-compatible (libSQL) via Drizzle ORM** for all app data - companies, catalysts, raw
  sources, local users. Locally this is a plain file (`local.db`); in production it's a hosted
  Turso database - same driver, same schema, no code changes (see [DEPLOYMENT.md](DEPLOYMENT.md))
- **Supabase Cloud** for Auth only (its own Postgres database is *not* used for app data)
- **SEC EDGAR** (free, no API key) as the first data vendor
- AI classification/scoring (Groq hosting Qwen3-32B) is planned for a later phase - not wired up yet

## One-time setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a free Supabase project (for Auth) and enable Google sign-in

1. Go to [supabase.com](https://supabase.com) and create a new project (free tier).
2. In **Authentication -> Providers**, enable **Google** (this is the *only* sign-in method - no
   passwords are ever collected or stored by this app). Follow Supabase's
   [Google OAuth guide](https://supabase.com/docs/guides/auth/social-login/auth-google) to create a
   Google Cloud OAuth Client ID/Secret and paste them in. The redirect URI Google needs is shown on
   that Supabase provider settings page (`https://<your-project-ref>.supabase.co/auth/v1/callback`).
3. In **Project Settings -> API**, copy the **Project URL** and **anon public** key.

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the Supabase values:

```bash
cp .env.example .env.local
```

| Variable | Required now? | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes (default is fine) | Local SQLite file path |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | From Supabase Project Settings -> API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | From Supabase Project Settings -> API |
| `SEC_EDGAR_USER_AGENT` | Yes | SEC requires a descriptive contact string, e.g. `you@email.com CatalystIntel/0.1` |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Reserved for future admin operations |
| `GROQ_API_KEY` | No | Only needed once AI scoring is added |

No SEC/FDA/ClinicalTrials.gov API keys are needed - those vendors are free and keyless.

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

### 6. Create an account and promote yourself to admin

1. Go to `/login` and click **Continue with Google** - this creates your account automatically
   (no separate signup step, no password).
2. That first sign-in creates your row in the local `users` table.
3. Promote yourself to admin so you can trigger data ingestion:

   ```bash
   npm run make-admin -- you@email.com
   ```

### 7. Populate real data

Go to `/admin` and click **"Fetch SEC EDGAR now"**. This pulls the latest 8-K filings from SEC
EDGAR's free feed, resolves tickers where possible, and stores them. Then check `/dashboard` to
see them listed.

### 8. (Optional) Keep data flowing continuously while developing

Instead of manually clicking the admin button, run the local cron in its own terminal:

```bash
npm run cron
```

This fetches immediately, then re-fetches every `CRON_INTERVAL_MINUTES` (default `2`). Leave it
running while you develop and `/dashboard` stays up to date. Stop with `Ctrl+C`.

## Staging & production

Local machines always use SQLite (`DATABASE_URL=file:./local.db`). Staging is the `dev` branch on
Vercel; production is `main`. Env vars for each environment (and CI/CD triggers) are documented in
[DEPLOYMENT.md](DEPLOYMENT.md).

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run db:generate` | Generate a new Drizzle migration after changing `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations to `local.db` |
| `npm run db:studio` | Open Drizzle Studio to browse `local.db` |
| `npm run make-admin -- <email>` | Promote a logged-in user to admin |
| `npm run cron` | Continuously re-fetch SEC EDGAR every `CRON_INTERVAL_MINUTES` (local dev) |

## Architecture notes

- **libSQL (SQLite-compatible) holds all app data**, via `@libsql/client` + `drizzle-orm/libsql`.
  Locally it opens a plain file; in production it points at a hosted Turso database instead - no
  driver or schema changes needed, just different env vars (`LIBSQL_URL`/`LIBSQL_AUTH_TOKEN`).
  Supabase Cloud is used only for Auth; its Postgres database is not touched by the app.
- **`src/proxy.ts`** (Next.js 16's replacement for `middleware.ts`) refreshes the Supabase session
  cookie and does a cheap, optimistic redirect for signed-out visitors. The real authorization
  check lives in `getCurrentAppUser()`, called directly from `/dashboard` and `/admin`.
- **Data ingestion** can be triggered three ways, all calling the same
  [src/lib/jobs/fetch-sec-edgar.ts](src/lib/jobs/fetch-sec-edgar.ts): the `/admin` page button
  (session auth), `npm run cron` (local, continuous), or a scheduled GitHub Actions workflow in
  production (`x-cron-secret` header auth) - see [DEPLOYMENT.md](DEPLOYMENT.md).
- **`src/lib/jobs/fetch-sec-edgar.ts`** dedupes by SEC accession number, so re-running the fetch is
  always safe.

## What's next (not in this pass)

- AI classification/scoring/summarization via Groq (Qwen3-32B)
- Additional vendors: FDA openFDA, ClinicalTrials.gov
- Watchlists and alerts
- Deciding if/when to migrate app data to Supabase Postgres instead of Turso
