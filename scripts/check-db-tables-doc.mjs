#!/usr/bin/env node
/**
 * Fail when root DB-TABLES.md is out of sync with sqliteTable() names in
 * src/db/schema.ts. Also blocks schema-table commits that forget to stage
 * the doc.
 *
 * Exit 0 = ok; exit 1 = block the commit / CI.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SCHEMA = "src/db/schema.ts";
const DOC = "DB-TABLES.md";

function fail(message) {
  console.error(`\n✖ DB-TABLES.md check failed:\n  ${message}\n`);
  console.error(
    "Fix: update DB-TABLES.md so every sqliteTable in src/db/schema.ts has a one-liner row (and the **N tables** count matches).\nSee .cursor/skills/db-tables-doc/SKILL.md\n",
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
  try {
    git(["rev-parse", "--is-inside-work-tree"]);
  } catch {
    return null;
  }
  const out = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
  return out ? out.split("\n").filter(Boolean) : [];
}

/** Parse `sqliteTable("name"` declarations from schema source text. */
function tablesFromSchema(source) {
  const names = new Set();
  const re = /sqliteTable\(\s*["']([a-z][a-z0-9_]*)["']/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    names.add(match[1]);
  }
  return names;
}

/**
 * Tables documented as `| \`name\` |` rows in DB-TABLES.md.
 * Ignores inline backticks elsewhere (links, prose).
 */
function tablesFromDoc(source) {
  const names = new Set();
  const re = /^\|\s*`([a-z][a-z0-9_]*)`\s*\|/gm;
  let match;
  while ((match = re.exec(source)) !== null) {
    names.add(match[1]);
  }
  return names;
}

function declaredCount(source) {
  const match = source.match(/\*\*(\d+)\s+tables?\*\*/i);
  return match ? Number(match[1]) : null;
}

function sorted(set) {
  return [...set].sort();
}

function main() {
  const schemaPath = join(ROOT, SCHEMA);
  const docPath = join(ROOT, DOC);

  if (!existsSync(schemaPath)) {
    fail(`Missing ${SCHEMA}`);
  }
  if (!existsSync(docPath)) {
    fail(`Missing ${DOC} — create it from schema (see db-tables-doc skill)`);
  }

  const schemaSrc = readFileSync(schemaPath, "utf8");
  const docSrc = readFileSync(docPath, "utf8");
  const schemaTables = tablesFromSchema(schemaSrc);
  const docTables = tablesFromDoc(docSrc);

  if (schemaTables.size === 0) {
    fail(`No sqliteTable("…") found in ${SCHEMA}`);
  }
  if (docTables.size === 0) {
    fail(`No | \`table\` | rows found in ${DOC}`);
  }

  const missingInDoc = sorted(schemaTables).filter((t) => !docTables.has(t));
  const extraInDoc = sorted(docTables).filter((t) => !schemaTables.has(t));

  if (missingInDoc.length > 0 || extraInDoc.length > 0) {
    const parts = [];
    if (missingInDoc.length > 0) {
      parts.push(
        `in schema but missing from ${DOC}: ${missingInDoc.join(", ")}`,
      );
    }
    if (extraInDoc.length > 0) {
      parts.push(`in ${DOC} but not in schema: ${extraInDoc.join(", ")}`);
    }
    fail(parts.join("\n  "));
  }

  const count = declaredCount(docSrc);
  if (count === null) {
    fail(
      `${DOC} must include a "**N tables**" line matching the schema table count`,
    );
  }
  if (count !== schemaTables.size) {
    fail(`${DOC} says **${count} tables** but schema has ${schemaTables.size}`);
  }

  const staged = stagedFiles();
  if (staged && staged.includes(SCHEMA) && !staged.includes(DOC)) {
    // Only require the doc when table names actually changed vs HEAD.
    let headSchema = "";
    try {
      headSchema = git(["show", `HEAD:${SCHEMA}`]);
    } catch {
      // First commit / missing — treat as changed.
      headSchema = "";
    }
    const headTables = headSchema ? tablesFromSchema(headSchema) : new Set();
    const same =
      headTables.size === schemaTables.size &&
      [...schemaTables].every((t) => headTables.has(t));
    if (!same) {
      fail(
        `${SCHEMA} table set changed but ${DOC} is not staged. Update and stage ${DOC} in the same commit.`,
      );
    }
  }

  console.log(
    `✓ DB-TABLES.md in sync (${schemaTables.size} tables: ${sorted(schemaTables).join(", ")})`,
  );
}

main();
