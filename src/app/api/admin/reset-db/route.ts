import path from "node:path";

import { migrate } from "drizzle-orm/libsql/migrator";
import { type NextRequest } from "next/server";

import { db } from "@/db/client";
import { authorizeAdminFetch, jsonWithAuth } from "@/lib/auth/admin-fetch";
import { fetchAllCatalystSources } from "@/lib/jobs/fetch-all-sources";
import { recordIngestionRun } from "@/lib/jobs/record-ingestion-run";
import { clearIngestData } from "@/lib/ops/clear-ingest-data";
import { isNonProductionEnv } from "@/lib/ops/non-production-env";

/**
 * Non-production only: clear catalyst ingest tables, apply migrations, and
 * optionally re-run multi-source fetch. Blocked when VERCEL_ENV=production.
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeAdminFetch(request, "admin-reset-db");
  if (!auth.ok) {
    return auth.response;
  }

  if (!isNonProductionEnv()) {
    return jsonWithAuth(
      auth,
      {
        error:
          "Clear database is disabled in production (VERCEL_ENV=production).",
      },
      { status: 403 },
    );
  }

  let runIngest = true;
  try {
    const body = (await request.json()) as { runIngest?: unknown };
    if (typeof body.runIngest === "boolean") {
      runIngest = body.runIngest;
    }
  } catch {
    // empty / non-JSON body → default runIngest true
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
