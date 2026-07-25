---
name: local-ci-check
description: >-
  Runs this repo's CI checks locally (format, lint, unit tests, migrations +
  build) to verify a fix or feature actually works before calling it done,
  telling the user something is fixed, or opening/updating a PR. Use after
  making non-trivial code changes in catalyst-intel, and always before
  declaring a bug fixed or a feature complete.
---

# Local CI check

Mirrors `.github/workflows/ci.yml` so failures surface locally instead of
after pushing. Run all four steps, in order, and treat any failure as
unresolved work - fix it and re-run before saying the task is done.

```bash
npm run format:check
npm run lint
npm test
npm run db:check
npm run build
```

## Notes

- `npm run db:check` enforces Drizzle schema↔migration sync (also runs on
  husky pre-commit). See `.cursor/skills/drizzle-migrations/SKILL.md`.
- `npm run build` runs `drizzle-kit migrate && next build` - it also verifies
  every committed migration file applies cleanly, and needs enough
  placeholder env vars to not fail on missing config. If they aren't already
  set in your shell, prefix the build with the same placeholders CI uses (see
  `env:` in `ci.yml`):

  ```bash
  DATABASE_URL="file:./local.db" \
  NEXT_PUBLIC_SUPABASE_URL="https://placeholder.supabase.co" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder-anon-key" \
  SEC_EDGAR_USER_AGENT="catalyst-intel-ci ci@example.com" \
  npm run build
  ```

  If the build used a throwaway `DATABASE_URL=file:./local.db`, recreate a
  real local DB afterward so the next `npm run dev` isn't stuck on a missing
  or 0-byte file (`no such table: users`):

  ```bash
  rm -f local.db
  npm run db:migrate
  ```

  Never leave a 0-byte `local.db` behind — libSQL will open it and every
  desk query will fail until migrate runs.

- `npm run format:check` and `npm run lint` don't touch the database and need
  no env vars.
- If a step fails, fix the root cause rather than skipping or weakening the
  check (e.g. don't delete a failing test to make it pass).
- This is a local approximation of CI, not a replacement for it - CI on the
  PR is still the source of truth once pushed.
