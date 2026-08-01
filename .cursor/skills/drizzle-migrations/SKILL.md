---
name: drizzle-migrations
description: >-
  Keeps Drizzle/Turso schema and SQL migrations in sync on every commit so
  staging/production DBs always adjust correctly on merge/deploy. Use whenever
  editing src/db/schema.ts, adding columns/tables, generating or reviewing
  drizzle/*.sql, committing schema changes, or when the user mentions
  migrations, db:generate, migrate on merge, or schema drift.
---

# Drizzle migrations (every commit)

**Hard rule:** Never commit `src/db/schema.ts` changes without the matching
`drizzle/` migration artifacts in the **same commit**. Merging to `dev`/`main`
runs `drizzle-kit migrate` on build — missing SQL = broken or stale DBs.

## When this skill applies

- Editing `src/db/schema.ts`
- Adding/removing tables, columns, indexes, or enums
- Creating a commit that touches schema or `drizzle/`
- User asks about migrations, Turso schema, or “DB on merge”

## Required workflow (do this every time)

```
1. Edit src/db/schema.ts
2. npm run db:generate
3. Review the new drizzle/000N_*.sql — MUST be additive only
4. Stage schema + drizzle SQL + drizzle/meta together
5. npm run db:check   # also runs on husky pre-commit
6. Commit
```

### Review the generated SQL (critical)

`drizzle-kit generate` can incorrectly **re-CREATE tables that already exist**
when historical `drizzle/meta/*_snapshot.json` files are missing (this repo
historically lacks snapshots for 0002–0004).

**Before committing a new migration SQL file:**

- Keep only **new** statements: `CREATE TABLE` for brand-new tables,
  `ALTER TABLE … ADD …` for new columns
- **Delete** any `CREATE TABLE` / indexes for tables already created in earlier
  migrations (`users`, `companies`, `raw_sources`, `catalysts`,
  `watchlist_entries`, `playbook_settings`, `alert_rules`, `nyse_listings`, …)
- Do **not** re-add columns that already exist from prior migrations
  (e.g. `subcategory`, `confidence`, `tags`, `historical_impact` from 0004)

### Same-commit checklist

- [ ] `src/db/schema.ts` staged
- [ ] New `drizzle/000N_*.sql` staged (reviewed)
- [ ] `drizzle/meta/_journal.json` + new `drizzle/meta/000N_snapshot.json` staged
- [ ] If tables were added/removed/renamed: update root `DB-TABLES.md` (see
      [db-tables-doc](../db-tables-doc/SKILL.md))
- [ ] `npm run db:check` passes
- [ ] Prefer verifying with local CI build placeholders (see `local-ci-check` skill)

## Commands

| Script                | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `npm run db:generate` | Diff schema → write next `drizzle/*.sql` + meta                |
| `npm run db:check`    | Journal/SQL consistency + block schema-only commits            |
| `npm run db:migrate`  | Apply pending migrations to `DATABASE_URL` / Turso             |
| `npm run build`       | `node scripts/migrate.mjs && next build` (also runs on Vercel) |

## How migrations land on merge

- **CI** (`ci.yml`): `npm run build` against throwaway `file:./local.db` — broken SQL fails the PR
- **Vercel**: build on `dev` / `main` migrates that env’s Turso DB before `next build`
- **GHA** (`migrate.yml`): redundant explicit migrate against staging/prod Turso — currently a
  no-op until `PROD_*`/`STAGING_*` LIBSQL secrets are set (see `DEPLOYMENT.md`)

`npm run build` / `npm run db:migrate` call `scripts/migrate.mjs` (drizzle-orm's programmatic
migrator), not the `drizzle-kit migrate` CLI — the CLI's spinner can swallow its own error text
in non-TTY build logs (see `DEPLOYMENT.md` → "Why `scripts/migrate.mjs`..."). If you need to
change how migrations are applied, edit that script rather than reintroducing the CLI call.

Do **not** hand-edit production DBs. Ship SQL via this flow.

## Never do

- Commit schema without generated SQL
- Add/remove/rename tables without updating `DB-TABLES.md` in the same commit
- Use `db:push` for shared staging/prod (bypasses migration history)
- Squash/delete applied migration files from history
- Skip husky / `--no-verify` to bypass `db:check` unless the user explicitly requests it
- Trust generate output blindly when it recreates existing tables

## If `db:check` fails

1. Read the error — usually missing SQL for a journal tag, or schema staged without a new migration
2. `npm run db:generate`
3. Hand-trim the SQL to additive-only changes
4. Stage `src/db/schema.ts` + all new `drizzle/**` files
5. Re-run `npm run db:check`
