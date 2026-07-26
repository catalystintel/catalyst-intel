#!/usr/bin/env node
/**
 * Programmatic migration runner used by `npm run build` (Vercel + CI) and
 * `npm run db:migrate` (local / manual / GitHub Actions `migrate.yml`).
 *
 * Why not the `drizzle-kit migrate` CLI directly?
 *
 * Its interactive progress view (hanji's `TaskView`, rendered as
 * `[spinner] applying migrations...`) redraws the same terminal line with
 * carriage returns. In a real TTY that looks fine, but in a non-TTY build
 * log (Vercel's build output, GitHub Actions) those redraws can clobber the
 * real `console.error(err)` text that `drizzle-kit migrate` itself prints on
 * failure, leaving only repeated spinner frames in the captured log with no
 * indication of *why* it failed.
 *
 * That's exactly what happened on the 2026-07-26 production deploy for PR
 * #246 ("Seeking Alpha tape titles" promote to `main`): the Vercel build log
 * showed only
 *
 *   Reading config file '/vercel/path0/drizzle.config.ts'
 *   Error: Command "npm run build" exited with 1
 *   [spinner] applying migrations...
 *
 * with the actual underlying error swallowed — undiagnosable from the log
 * alone. Calling drizzle-orm's migrator directly avoids the spinner
 * entirely, so failures print a normal, readable error/stack trace. A hard
 * timeout is also added so a stuck connection/lock fails the build quickly
 * instead of hanging until Vercel's overall build timeout kills it.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const MIGRATIONS_FOLDER = "./drizzle";
const TIMEOUT_MS = 60_000;

function resolveUrl() {
  return process.env.LIBSQL_URL || process.env.DATABASE_URL || "file:local.db";
}

function isRemoteUrl(url) {
  return /^(libsql|https|wss):\/\//.test(url);
}

async function main() {
  const url = resolveUrl();
  const authToken = process.env.LIBSQL_AUTH_TOKEN;

  console.log(
    `Applying pending migrations from ${MIGRATIONS_FOLDER} to ${isRemoteUrl(url) ? "remote libSQL/Turso DB" : url}...`,
  );

  const client = createClient({ url, authToken });
  const db = drizzle(client);

  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `Migration timed out after ${TIMEOUT_MS / 1000}s - check DB connectivity, an ` +
            "open lock/transaction on this database, or a stuck statement.",
        ),
      );
    }, TIMEOUT_MS);
  });

  try {
    await Promise.race([migrate(db, { migrationsFolder: MIGRATIONS_FOLDER }), timeout]);
    console.log("Migrations applied successfully.");
  } catch (err) {
    console.error("Migration failed:");
    console.error(err);
    process.exitCode = 1;
  } finally {
    clearTimeout(timer);
    client.close();
  }
}

main();
