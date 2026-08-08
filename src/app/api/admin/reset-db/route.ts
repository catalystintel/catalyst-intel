import path from "node:path";

import { migrate } from "drizzle-orm/libsql/migrator";
import { type NextRequest } from "next/server";

import { db } from "@/db/client";
import { authorizeAdminFetch, jsonWithAuth } from "@/lib/auth/admin-fetch";
import { fetchAllCatalystSources } from "@/lib/jobs/fetch-all-sources";
import { recordIngestionRun } from "@/lib/jobs/record-ingestion-run";
import { clearIngestData } from "@/lib/ops/clear-ingest-data";
import { DB_RESET_CONFIRM_PHRASE } from "@/lib/ops/non-production-env";

/**
 * Admin-only: clear catalyst ingest tables, apply migrations, and optionally
 * re-run multi-source fetch. Allowed in every environment (including
 * production). Requires an interactive admin session (not cron) and body
 * `confirm: "delete"`.
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeAdminFetch(request, "admin-reset-db");
  if (!auth.ok) {
    return auth.response;
  }

  if (auth.isCron) {
    return jsonWithAuth(
      auth,
      {
        error:
          "Clear database requires an interactive admin session (not cron).",
      },
      { status: 403 },
    );
  }

  let runIngest = true;
  let confirm = "";
  try {
    const body = (await request.json()) as {
      runIngest?: unknown;
      confirm?: unknown;
    };
    if (typeof body.runIngest === "boolean") {
      runIngest = body.runIngest;
    }
    if (typeof body.confirm === "string") {
      confirm = body.confirm;
    }
  } catch {
    // empty / non-JSON body
  }

  if (confirm !== DB_RESET_CONFIRM_PHRASE) {
    return jsonWithAuth(
      auth,
      {
        error: `Type "${DB_RESET_CONFIRM_PHRASE}" to confirm clearing the database.`,
      },
      { status: 400 },
    );
  }

  try {
    const cleared = await clearIngestData();

    const migrationsFolder = path.join(process.cwd(), "drizzle");
    await migrate(db, { migrationsFolder });

    let ingest: Awaited<ReturnType<typeof fetchAllCatalystSources>> | null =
      null;
    if (runIngest) {
      const started = Date.now();
      ingest = await fetchAllCatalystSources();
      try {
        await recordIngestionRun({
          result: ingest,
          trigger: "admin",
          durationMs: Date.now() - started,
        });
      } catch {
        // Audit write must not fail the reset.
      }
    }

    return jsonWithAuth(auth, {
      ok: true,
      environment: process.env.VERCEL_ENV ?? "local",
      cleared,
      migrated: true,
      ingest: ingest
        ? {
            ranAt: ingest.ranAt,
            totals: ingest.totals,
            sources: ingest.sources.map((s) => ({
              source: s.source,
              status: s.status,
              inserted: s.inserted,
              skipped: s.skipped,
              errors: s.errors,
              message: s.message,
            })),
          }
        : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Reset database failed.";
    return jsonWithAuth(auth, { error: message }, { status: 500 });
  }
}
