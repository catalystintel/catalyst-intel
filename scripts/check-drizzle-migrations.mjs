#!/usr/bin/env node
/**
 * Fail the commit when Drizzle schema and migrations are out of sync.
 *
 * Checks:
 * 1. `drizzle-kit check` — journal/snapshot consistency
 * 2. Every journal tag has a matching `drizzle/<tag>.sql` file
 * 3. If `src/db/schema.ts` is staged, either matching `drizzle/` artifacts
 *    are staged too, or `drizzle-kit generate` is a no-op (comments-only
 *    schema edit). Never leave a schema-only commit that would ship without
 *    SQL for merge/deploy.
 *
 * Exit 0 = ok; exit 1 = block the commit.
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SCHEMA = "src/db/schema.ts";
const DRIZZLE_DIR = "drizzle";
const JOURNAL = join(DRIZZLE_DIR, "meta", "_journal.json");

function fail(message) {
  console.error(`\n✖ drizzle migration check failed:\n  ${message}\n`);
  console.error(
    "Fix: edit src/db/schema.ts → npm run db:generate → review drizzle/*.sql (additive only) → stage schema + drizzle/ together.\nSee .cursor/skills/drizzle-migrations/SKILL.md\n",
  );
  process.exit(1);
}

function git(args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
}

function stagedFiles() {
  const out = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
  return out ? out.split("\n").filter(Boolean) : [];
}

function listSqlTags() {
  return new Set(
    readdirSync(join(ROOT, DRIZZLE_DIR))
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.replace(/\.sql$/, "")),
  );
}

function listMetaFiles() {
  const metaDir = join(ROOT, DRIZZLE_DIR, "meta");
  if (!existsSync(metaDir)) return new Set();
  return new Set(readdirSync(metaDir).map((f) => join(DRIZZLE_DIR, "meta", f)));
}

function snapshotDrizzleState() {
  const sql = listSqlTags();
  const meta = listMetaFiles();
  const journalPath = join(ROOT, JOURNAL);
  const journalMtime = existsSync(journalPath)
    ? statSync(journalPath).mtimeMs
    : 0;
  return { sql, meta, journalMtime };
}

/** Run local drizzle-kit without `npx` (Windows `execFileSync("npx")` fails on `.cmd`). */
function runDrizzleKit(args) {
  const bin = join(ROOT, "node_modules", "drizzle-kit", "bin.cjs");
  if (!existsSync(bin)) {
    throw new Error(`Missing ${bin}; run npm install`);
  }
  return execFileSync(process.execPath, [bin, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function runDrizzleCheck() {
  try {
    runDrizzleKit(["check"]);
  } catch (err) {
    const stderr =
      err && typeof err === "object" && "stderr" in err
        ? String(err.stderr)
        : "";
    const stdout =
      err && typeof err === "object" && "stdout" in err
        ? String(err.stdout)
        : "";
    fail(
      `drizzle-kit check reported problems:\n${(stdout || stderr || String(err)).trim()}`,
    );
  }
}

function verifyJournalSqlPairs() {
  if (!existsSync(join(ROOT, JOURNAL))) {
    fail(`Missing ${JOURNAL}`);
  }

  let journal;
  try {
    journal = JSON.parse(readFileSync(join(ROOT, JOURNAL), "utf8"));
  } catch (err) {
    fail(`Could not parse ${JOURNAL}: ${err}`);
  }

  const entries = Array.isArray(journal.entries) ? journal.entries : [];
  if (entries.length === 0) {
    fail(`${JOURNAL} has no entries`);
  }

  const sqlFiles = listSqlTags();
  for (const entry of entries) {
    const tag = entry?.tag;
    if (typeof tag !== "string" || !tag) {
      fail("Journal entry missing tag");
    }
    if (!sqlFiles.has(tag)) {
      fail(
        `Journal tag "${tag}" has no matching ${DRIZZLE_DIR}/${tag}.sql — generate or restore the SQL file`,
      );
    }
  }
}

/**
 * If generate created new files during the check, remove them so a failed
 * pre-commit does not leave untracked junk in the working tree.
 */
function revertGenerateArtifacts(before) {
  const afterSql = listSqlTags();
  for (const tag of afterSql) {
    if (!before.sql.has(tag)) {
      const path = join(ROOT, DRIZZLE_DIR, `${tag}.sql`);
      if (existsSync(path)) rmSync(path);
    }
  }

  const afterMeta = listMetaFiles();
  for (const rel of afterMeta) {
    if (!before.meta.has(rel)) {
      const path = join(ROOT, rel);
      if (existsSync(path)) rmSync(path);
    }
  }

  // Restore journal from git if generate rewrote it.
  try {
    git(["checkout", "--", JOURNAL]);
  } catch {
    // Not tracked yet / clean — ignore.
  }
}

function verifySchemaCommitIncludesMigrations(staged) {
  if (!staged.includes(SCHEMA)) return;

  const drizzleStaged = staged.filter(
    (f) =>
      f.startsWith(`${DRIZZLE_DIR}/`) &&
      (f.endsWith(".sql") || f.includes(`${DRIZZLE_DIR}/meta/`)),
  );

  if (drizzleStaged.length > 0) {
    // Schema + migration artifacts staged together — good.
    return;
  }

  // Schema-only staging: only OK if generate is a no-op.
  const before = snapshotDrizzleState();
  try {
    runDrizzleKit(["generate"]);
  } catch (err) {
    revertGenerateArtifacts(before);
    const stderr =
      err && typeof err === "object" && "stderr" in err
        ? String(err.stderr)
        : String(err);
    fail(
      `drizzle-kit generate failed while verifying schema commit:\n${stderr}`,
    );
  }

  const after = snapshotDrizzleState();
  const createdSql = [...after.sql].filter((t) => !before.sql.has(t));

  if (createdSql.length > 0) {
    revertGenerateArtifacts(before);
    fail(
      `${SCHEMA} is staged but needs a new migration (${createdSql.map((t) => `${t}.sql`).join(", ")}). ` +
        `Run \`npm run db:generate\`, review the SQL (strip any CREATE TABLE for already-migrated tables), ` +
        `and stage ${DRIZZLE_DIR}/ with the schema.`,
    );
  }
}

function main() {
  runDrizzleCheck();
  verifyJournalSqlPairs();

  try {
    git(["rev-parse", "--is-inside-work-tree"]);
  } catch {
    console.log("✓ drizzle migration check passed (not a git repo)");
    return;
  }

  const staged = stagedFiles();
  if (staged.length > 0) {
    verifySchemaCommitIncludesMigrations(staged);
  }

  console.log("✓ drizzle migration check passed");
}

main();
