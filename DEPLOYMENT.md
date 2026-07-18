# Deploying Catalyst Intel to production

This is a step-by-step manual for going from "working locally" to "live on the internet with
automatic deploys and a running data-ingestion cron." Nothing here has been run yet - follow it
whenever you're ready to go live.

## Why these choices (read this first)

- **Database: Turso instead of a local SQLite file.** Vercel's serverless functions don't have a
  durable, writable filesystem across invocations, so the local `local.db` file approach can't
  work in production. Turso is a hosted version of the exact same SQLite dialect (libSQL) - the
  app already speaks this driver (`@libsql/client` / `drizzle-orm/libsql`), so going to production
  is just swapping which URL/token it points at. No schema rewrite, no new query syntax.
- **Hosting: Vercel.** Matches the original product blueprint, has zero-config Next.js support,
  and its GitHub integration *is* your CD pipeline - every push to `main` auto-deploys, no custom
  deploy workflow needed.
- **Production cron cadence: GitHub Actions, every 5 minutes.** The product goal is "every 1-2
  minutes," but no free option hits that reliably: Vercel's Hobby plan only allows one cron run
  *per day*; Vercel Pro gets you per-minute cron but costs $20/mo; GitHub Actions' scheduled
  workflows have a hard 5-minute floor and are best-effort (expect occasional delays, especially
  at the top of the hour). Five minutes was chosen as the closest free, simple option. If ingestion
  freshness becomes a real product requirement later, revisit Vercel Pro or an external pinger
  service (e.g. cron-job.org) as documented alternatives.
- **Cron auth: a shared secret header, not a login session.** The `/admin` page's fetch button
  authenticates via your browser's Supabase session cookie. A GitHub Actions job has no browser and
  no cookie, so it instead sends a `x-cron-secret` header that the API route checks against a
  `CRON_SECRET` environment variable (see [src/app/api/admin/fetch/sec-edgar/route.ts](src/app/api/admin/fetch/sec-edgar/route.ts)).

## 1. Create a Turso database

Install the Turso CLI:

```powershell
# Windows (native)
powershell -ExecutionPolicy Bypass -c "irm https://github.com/tursodatabase/turso/releases/latest/download/turso_cli-installer.ps1 | iex"
```

(Alternatively, on Windows via WSL: `curl -sSfL https://get.tur.so/install.sh | bash`.)

Then:

```bash
turso auth signup      # opens your browser to create a free account
turso db create catalyst-intel
turso db show catalyst-intel --url        # copy this - it's LIBSQL_URL
turso db tokens create catalyst-intel     # copy this - it's LIBSQL_AUTH_TOKEN
```

Push the existing schema to it (run locally, once, using the Turso credentials you just got):

```bash
$env:LIBSQL_URL = "<url from above>"
$env:LIBSQL_AUTH_TOKEN = "<token from above>"
npm run db:migrate
```

This creates the `users`, `companies`, `raw_sources`, and `catalysts` tables on Turso, identical to
your local schema.

## 2. Create a Vercel project

1. Go to [vercel.com](https://vercel.com) and sign up (free Hobby plan is fine).
2. **Import Project** -> select the `zhbar10/catalyst-intel` GitHub repo.
3. Framework preset should auto-detect as Next.js. Leave build settings as default.
4. Don't deploy yet - add the environment variables first (next section), then deploy.

Once imported, **this alone is your CD pipeline**: every push to `main` triggers a new Vercel
deployment automatically. No GitHub Actions deploy workflow is needed (`.github/workflows/ci.yml`
only runs lint/build *checks*, it does not deploy anything).

## 3. Set environment variables in Vercel

In the Vercel project -> **Settings -> Environment Variables**, add:

| Variable | Value | Public? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | From your Supabase project settings | Yes (safe to expose - it's a public URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From your Supabase project settings | Yes (designed to be public; RLS protects data) |
| `SEC_EDGAR_USER_AGENT` | e.g. `you@email.com CatalystIntel/1.0` | No need to be secret, but no reason to expose either |
| `LIBSQL_URL` | From `turso db show` above | Keep private |
| `LIBSQL_AUTH_TOKEN` | From `turso db tokens create` above | **Secret** |
| `CRON_SECRET` | Any long random string (see below) | **Secret** |

Generate a `CRON_SECRET` value:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Deploy (or redeploy) after adding these.

## 4. Add GitHub repo secrets (for the cron workflow)

The already-committed [.github/workflows/fetch-sec-edgar-cron.yml](.github/workflows/fetch-sec-edgar-cron.yml)
needs two repo secrets to actually do anything - until they're set, it runs every 5 minutes and
exits cleanly with a "not configured yet" message (harmless).

```bash
gh secret set PROD_APP_URL --body "https://<your-vercel-domain>"
gh secret set CRON_SECRET --body "<same value you put in Vercel>"
```

Find your Vercel domain in the Vercel dashboard (Settings -> Domains), or use the
`*.vercel.app` domain Vercel assigns automatically on first deploy.

## 5. Verify everything works

1. Push to `main` (or just wait if you just deployed) - confirm the deployment succeeds in the
   Vercel dashboard.
2. Go to **Actions** tab on GitHub -> `Fetch SEC EDGAR (production cron)` -> **Run workflow**
   (manual trigger, via `workflow_dispatch`) to test immediately rather than waiting up to 5
   minutes. Confirm it logs a successful HTTP 200 with fetch results.
3. Visit `https://<your-vercel-domain>/dashboard` (after signing up + logging in + promoting
   yourself to admin - same steps as local, in [README.md](README.md)) and confirm catalysts are
   listed.
4. Watch the Actions tab over the next 15-20 minutes to confirm the schedule keeps firing
   (expect occasional delay - this is normal GitHub Actions behavior, not a bug).

## Future improvements (not done yet)

- If 5-minute cadence isn't fresh enough: upgrade to Vercel Pro for native per-minute cron, or
  point an external free pinger (e.g. cron-job.org) at the same endpoint.
- Add the same `CRON_SECRET` pattern to future vendor jobs (FDA, ClinicalTrials.gov) as they're
  added.
- Consider Vercel preview deployments + a staging Turso database once there's a second contributor.
