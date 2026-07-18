# Catalyst Intel

Real-time market catalyst intelligence: detects, stores, and (soon) scores events that can move
publicly traded stocks - built for active traders and independent analysts.

This is the first working slice of the platform: a local-first Next.js app with SEC EDGAR
filings flowing into a dashboard, gated behind Supabase-backed auth.

## Stack (this phase)

- **Next.js 16 + TypeScript** (App Router), **Tailwind CSS**, **shadcn/ui** (dark theme default)
- **SQLite** (via Drizzle ORM) for all app data - companies, catalysts, raw sources, local users
- **Supabase Cloud** for Auth only (its own Postgres database is *not* used for app data)
- **SEC EDGAR** (free, no API key) as the first data vendor
- AI classification/scoring (Groq hosting Qwen3-32B) is planned for a later phase - not wired up yet

## One-time setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a free Supabase project (for Auth)

1. Go to [supabase.com](https://supabase.com) and create a new project (free tier).
2. In **Authentication -> Providers**, make sure **Email** is enabled.
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

1. Sign up at `/signup` with your email and password (check your email if Supabase requires
   confirmation - this depends on your project's auth settings).
2. Log in once - this creates your row in the local `users` table.
3. Promote yourself to admin so you can trigger data ingestion:

   ```bash
   npm run make-admin -- you@email.com
   ```

### 7. Populate real data

Go to `/admin` and click **"Fetch SEC EDGAR now"**. This pulls the latest 8-K filings from SEC
EDGAR's free feed, resolves tickers where possible, and stores them. Then check `/dashboard` to
see them listed.

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run db:generate` | Generate a new Drizzle migration after changing `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations to `local.db` |
| `npm run db:studio` | Open Drizzle Studio to browse `local.db` |
| `npm run make-admin -- <email>` | Promote a logged-in user to admin |

## Architecture notes

- **SQLite holds all app data.** Supabase Cloud is used only for Auth; its Postgres database is
  not touched by the app.
- **`src/proxy.ts`** (Next.js 16's replacement for `middleware.ts`) refreshes the Supabase session
  cookie and does a cheap, optimistic redirect for signed-out visitors. The real authorization
  check lives in `getCurrentAppUser()`, called directly from `/dashboard` and `/admin`.
- **Data ingestion is manually triggered** for now via `/admin` -> `POST /api/admin/fetch/sec-edgar`.
  Wiring this into a real scheduler (GitHub Actions cron, Supabase Edge Functions) is a later step.
- **`src/lib/jobs/fetch-sec-edgar.ts`** dedupes by SEC accession number, so re-running the fetch is
  always safe.

## What's next (not in this pass)

- AI classification/scoring/summarization via Groq (Qwen3-32B)
- Additional vendors: FDA openFDA, ClinicalTrials.gov
- Watchlists and alerts
- Real scheduler for the fetch job
- Deciding if/when to migrate SQLite app-data tables to Supabase Postgres for production
