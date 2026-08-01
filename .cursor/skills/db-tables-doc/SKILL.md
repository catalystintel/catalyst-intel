---
name: db-tables-doc
description: >-
  Keeps root DB-TABLES.md in sync with src/db/schema.ts. Use whenever editing
  schema (add/remove/rename tables), committing or pushing schema changes,
  generating migrations, or when the user asks what tables exist / what’s in
  the DB. Update DB-TABLES.md in the same commit as schema changes — before
  every push that touches the schema. Enforced by npm run db:check / husky
  pre-commit (scripts/check-db-tables-doc.mjs).
---

# DB tables doc (keep `DB-TABLES.md` current)

**Hard rule:** Any commit that adds, removes, or renames a table in
`src/db/schema.ts` must update root [`DB-TABLES.md`](../../../DB-TABLES.md) in
the **same commit**. Pushing schema without refreshing that doc is incomplete.

**Enforced on commit:** `npm run db:check` (husky pre-commit) runs
`scripts/check-db-tables-doc.mjs`, which fails if:

- A `sqliteTable("…")` is missing from `DB-TABLES.md` (or vice versa)
- The `**N tables**` count is wrong
- Schema table names changed but `DB-TABLES.md` isn’t staged

Column-only / type-only edits do **not** require a doc change unless the
one-liner for that table becomes misleading.

## When this skill applies

- Editing `src/db/schema.ts` (especially `sqliteTable(...)` names)
- Running `npm run db:generate` / following the drizzle-migrations skill
- Committing or pushing anything that touches schema or `drizzle/`
- `db:check` / pre-commit fails on `DB-TABLES.md`
- User asks for a table inventory, “what’s in the DB”, or docs of tables

## Required workflow

```
1. Diff sqliteTable("...") names in src/db/schema.ts vs tables listed in DB-TABLES.md
2. Add / remove / rename rows so every table appears exactly once
3. Write a one-liner for what’s stored (purpose, not column laundry list)
4. Keep section grouping: Core market data | Users & desk | Alerts | Ops/ingest | Reports
   (create a new section only if none of those fit)
5. Update the "**N tables**" count near the top
6. Stage DB-TABLES.md with schema (+ drizzle migrations)
7. npm run db:tables-check   # or npm run db:check before commit / push
```

### One-liner style

- One sentence: what the row represents and why it exists
- Prefer purpose over column names (e.g. “per-vendor watermark/cursor”, not “last_fetched_at + last_status”)
- Match tone of existing rows in `DB-TABLES.md`

### Same-commit checklist (schema table changes)

- [ ] `src/db/schema.ts` staged
- [ ] Matching `drizzle/` migration artifacts staged (see drizzle-migrations skill)
- [ ] `DB-TABLES.md` updated (table list + count + one-liners) and staged
- [ ] `npm run db:check` passes
- [ ] Ready to push — doc is not a follow-up PR

## Commands

| Script                    | Purpose                                              |
| ------------------------- | ---------------------------------------------------- |
| `npm run db:tables-check` | Schema ↔ `DB-TABLES.md` table-name sync only         |
| `npm run db:check`        | Migrations check **and** `DB-TABLES.md` sync (hook) |

## Never do

- Leave a new `sqliteTable` undocumented until “later”
- Delete a table from schema without removing it from `DB-TABLES.md`
- Expand `DB-TABLES.md` into a full column reference (that stays in `schema.ts`)
- Skip the doc update with `--no-verify` / “docs later”

## Related

- Migrations: [`.cursor/skills/drizzle-migrations/SKILL.md`](../drizzle-migrations/SKILL.md)
- Schema source of truth: [`src/db/schema.ts`](../../../src/db/schema.ts)
- Checker: [`scripts/check-db-tables-doc.mjs`](../../../scripts/check-db-tables-doc.mjs)
