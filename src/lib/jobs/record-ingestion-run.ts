import { desc, lt } from "drizzle-orm";

import { db } from "@/db/client";
import { ingestionRuns } from "@/db/schema";
import type { FetchAllSourcesResult } from "@/lib/jobs/fetch-all-sources";
import type { SourceFetchResult } from "@/lib/jobs/ingest-pipeline";

export type IngestionRunTrigger = "cron" | "admin";
export type IngestionRunStatus = "ok" | "partial" | "failed";

export interface IngestionRunSourceSnapshot {
  source: string;
  configured: boolean;
  status: SourceFetchResult["status"];
  fetched: number;
  inserted: number;
  skipped: number;
  errors: number;
  message?: string;
}

/** Keep enough history for ops review without unbounded Turso growth. */
const MAX_INGESTION_RUN_ROWS = 2_000;

export function deriveIngestionRunStatus(
  sources: SourceFetchResult[],
  totals: FetchAllSourcesResult["totals"],
): IngestionRunStatus {
  const actionable = sources.filter((s) => s.configured);
  const errored = actionable.filter((s) => s.status === "error");
  if (actionable.length > 0 && errored.length === actionable.length) {
    return "failed";
  }
  if (errored.length > 0 || totals.errors > 0) {
    return "partial";
  }
  return "ok";
}

export function toSourceSnapshots(
  sources: SourceFetchResult[],
): IngestionRunSourceSnapshot[] {
  return sources.map((s) => ({
    source: s.source,
    configured: s.configured,
    status: s.status,
    fetched: s.fetched,
    inserted: s.inserted,
    skipped: s.skipped,
    errors: s.errors,
    ...(s.message ? { message: s.message } : {}),
  }));
}

/**
 * Persists one audit row for a completed multi-source orchestrator run.
 * Best-effort: failures to write audit must not fail the fetch response.
 */
export async function recordIngestionRun(options: {
  result: FetchAllSourcesResult;
  trigger: IngestionRunTrigger;
  durationMs: number;
}): Promise<{ id: number } | null> {
  const { result, trigger, durationMs } = options;
  const status = deriveIngestionRunStatus(result.sources, result.totals);
  const sourcesJson = toSourceSnapshots(result.sources);

  try {
    const inserted = await db
      .insert(ingestionRuns)
      .values({
        ranAt: result.ranAt,
        trigger,
        status,
        fetched: result.totals.fetched,
        inserted: result.totals.inserted,
        skipped: result.totals.skipped,
        errors: result.totals.errors,
        durationMs,
        sourcesJson,
      })
      .returning({ id: ingestionRuns.id })
      .get();

    // Keep the newest MAX rows: find the oldest id still within the window,
    // then delete everything older than that.
    const cutoff = await db
      .select({ id: ingestionRuns.id })
      .from(ingestionRuns)
      .orderBy(desc(ingestionRuns.id))
      .limit(1)
      .offset(MAX_INGESTION_RUN_ROWS - 1)
      .get();

    if (cutoff) {
      await db
        .delete(ingestionRuns)
        .where(lt(ingestionRuns.id, cutoff.id))
        .run();
    }

    return inserted ?? null;
  } catch (error) {
    console.error("[ingestion-runs] failed to record run", error);
    return null;
  }
}
