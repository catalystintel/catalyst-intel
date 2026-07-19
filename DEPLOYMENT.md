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
- **Production cron** (`.github/workflows/fetch-sec-edgar-cron.yml`): scheduled GitHub Action
  hits the production URL with `x-cron-secret`. Inert until secrets are set.

## Env vars cheat sheet

### Local (`.env.local` on your machine)

| Variable                           | Required? | Notes                                                                                 |
| ---------------------------------- | --------- | ------------------------------------------------------------------------------------- |
| `DATABASE_URL`                     | Yes       | `file:./local.db` (default is fine)                                                   |
| `NEXT_PUBLIC_SUPABASE_URL`         | Yes       | Supabase Project Settings → API                                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | Yes       | Supabase Project Settings → API                                                       |
| `SEC_EDGAR_USER_AGENT`             | Yes       | e.g. `you@email.com CatalystIntel/0.1`                                                |
| `CRON_INTERVAL_MINUTES`            | No        | Default `2` for `npm run cron`                                                        |
| `NEXT_PUBLIC_POSTHOG_KEY`          | No        | PostHog Project API key; omit to disable analytics                                    |
| `NEXT_PUBLIC_POSTHOG_HOST`         | No        | Default `https://us.i.posthog.com`                                                    |
| `ADMIN_EMAILS`                     | No        | Comma-separated admin emails; defaults to `zhbar10@gmail.com,omer.nachshon@gmail.com` |
| `LIBSQL_URL` / `LIBSQL_AUTH_TOKEN` | No        | Leave unset locally - use the SQLite file                                             |
| `CRON_SECRET`                      | No        | Only needed for remote cron callers                                                   |

Auth is **Google OAuth only** via Supabase. Passwords are never collected or stored in our DB
(our `users` table only has id / supabase user id / email / role / subscription).

**Admin access** is enforced server-side from the verified Supabase session email against
`ADMIN_EMAILS` (or the built-in defaults). The local `users.role` column is synced as a cache
and is **not** the source of truth — do not rely on `npm run make-admin` alone. Manual fetch
via `/admin` uses the same allowlist; GitHub Actions cron still uses `x-cron-secret`.

### API rate limiting

Per-IP fixed-window limits live in `src/lib/http/rate-limit.ts` (in-memory Map):

| Route                                       | Default          | Notes                                 |
| ------------------------------------------- | ---------------- | ------------------------------------- |
| `GET /api/catalysts`                        | 90 / minute / IP | Live feed soft-refetch                |
| `POST /api/admin/fetch/sec-edgar` (session) | 6 / minute / IP  | Admin UI trigger                      |
| Same admin route with valid `x-cron-secret` | **bypassed**     | GitHub Actions cron must keep working |

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

### GitHub repo secrets (for production cron only)

| Secret         | Notes                                                                               |
| -------------- | ----------------------------------------------------------------------------------- |
| `PROD_APP_URL` | Production Vercel URL, e.g. `https://catalyst-intel.vercel.app` (no trailing slash) |
| `CRON_SECRET`  | Same value as Vercel Production `CRON_SECRET`                                       |

```bash
gh secret set PROD_APP_URL --body "https://<your-production-domain>"
gh secret set CRON_SECRET --body "<same value as Vercel Production>"
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

Migrate each once (from your machine / WSL, with the app repo checked out):

```powershell
# PowerShell
$env:LIBSQL_URL = "<staging url>"
$env:LIBSQL_AUTH_TOKEN = "<staging token>"
npm run db:migrate

$env:LIBSQL_URL = "<production url>"
$env:LIBSQL_AUTH_TOKEN = "<production token>"
npm run db:migrate
```

```bash
# bash / WSL
LIBSQL_URL="<staging url>" LIBSQL_AUTH_TOKEN="<staging token>" npm run db:migrate
LIBSQL_URL="<production url>" LIBSQL_AUTH_TOKEN="<production token>" npm run db:migrate
```

Then add the same values in Vercel → Settings → Environment Variables
(Preview = staging, Production = production) and redeploy.

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
3. Actions → `Fetch SEC EDGAR (production cron)` → **Run workflow** → expect HTTP 200.
4. Sign in with Google on the live URL using an allowlisted admin email (or set
   `ADMIN_EMAILS` on Vercel), open `/admin`, run a fetch, confirm `/dashboard` shows data.

## Why Turso (not local SQLite) on Vercel

Vercel serverless has no durable writable filesystem across invocations. Turso is hosted libSQL -
same driver and schema as local SQLite; only the URL/token change.

## Why GitHub Actions cron every 5 minutes

Closest free option to "every 1-2 minutes." Vercel Hobby allows one cron/day; Pro is $20/mo for
per-minute. Expect occasional schedule drift on GitHub Actions - that is normal.
