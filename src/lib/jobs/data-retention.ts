import { lt, notInArray } from "drizzle-orm";

import { db } from "@/db/client";
import { catalysts, rawSources } from "@/db/schema";

/**
 * How long ingested filings stay in the Live feed before being purged.
 * MVP policy - revisit once historical/backtesting use cases exist.
 */
export const RETENTION_DAYS = 30;

export interface RetentionResult {
  /** ISO cutoff - catalysts with an event timestamp before this are purged. */
  cutoff: string;
  deletedCatalysts: number;
  deletedRawSources: number;
}

/**
 * The ISO cutoff before which a catalyst is considered stale.
 *
 * @param now - Injectable clock for tests; defaults to `Date.now()`.
 * @param retentionDays - Override for tests; defaults to {@link RETENTION_DAYS}.
 */
export function computeRetentionCutoff(
  now: Date = new Date(),
  retentionDays: number = RETENTION_DAYS,
): string {
  return new Date(
    now.getTime() - retentionDays * 24 * 60 * 60 * 1000,
  ).toISOString();
}

/**
 * Deletes catalysts older than the retention window (by event timestamp,
 * not ingestion time), then deletes any raw source left with no catalyst
 * referencing it. Companies are left untouched - they're small, reused
 * dimension data, not raw event volume.
 *
 * @param now - Injectable clock for tests; defaults to `Date.now()`.
 * @returns Counts of what was purged, for logging/observability.
 */
export async function purgeStaleCatalysts(
  now: Date = new Date(),
): Promise<RetentionResult> {
  const cutoff = computeRetentionCutoff(now);

  const deletedCatalysts = await db
    .delete(catalysts)
    .where(lt(catalysts.timestamp, cutoff))
    .returning({ id: catalysts.id })
    .all();

  const deletedRawSources = await db
    .delete(rawSources)
    .where(
      notInArray(
        rawSources.id,
        db.select({ id: catalysts.rawSourceId }).from(catalysts),
      ),
    )
    .returning({ id: rawSources.id })
    .all();

  return {
    cutoff,
    deletedCatalysts: deletedCatalysts.length,
    deletedRawSources: deletedRawSources.length,
  };
}
