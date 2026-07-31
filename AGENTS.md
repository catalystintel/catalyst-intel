<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Standard commands live in `README.md`, `package.json` scripts, and the
`local-ci-check` skill (`.cursor/skills/local-ci-check/SKILL.md`). Notes below
are only the non-obvious, cloud-specific caveats.

- **Node version:** The project requires Node `>=24` (`.nvmrc` = 24), installed
  via `nvm`. The VM also ships a system `node` at `/exec-daemon/node` (v22) that
  is earlier in `PATH`; `~/.bashrc` prepends nvm's Node 24 so login shells use
  it. If `node -v` ever reports v22, run `nvm use 24` (or start a login shell)
  before building/running.
- **Local auth is bypassed:** Real login uses Supabase Google OAuth, which is
  not configured in this sandbox. `.env.local` (gitignored, present on the VM)
  sets `DEV_AUTH_BYPASS=true`, so the app auto-signs you in as the admin
  `DEV_AUTH_EMAIL`. No login form appears and `/admin` is accessible. Do not
  expect a working OAuth flow here.
- **The feed starts empty — you must trigger ingestion.** After `npm run dev`,
  `/catalyst-feed` and `GET /api/catalysts` return zero rows until data is
  fetched. Populate it any of these ways: click "Fetch" on `/admin`, run
  `npm run cron` in a second terminal, or `curl -X POST
http://localhost:3000/api/admin/fetch/sec-edgar` (or `.../fetch/all`). SEC
  EDGAR and the other keyless vendors need outbound internet, which works here.
- **Optional vendor/AI keys are soft-failing:** Finnhub, Polygon, OpenRouter,
  Resend, PostHog, and Turso are all optional; the app runs without them. SEC
  EDGAR + the other keyless sources are enough to populate a realistic feed.
- **Local DB is a file (`local.db`).** It persists on the VM. If it is missing
  or 0 bytes (`no such table: users`), stop all `next dev` processes, then run
  `npm run db:migrate`. Running `npm run build` also applies migrations.
