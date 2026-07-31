import { isNotNull } from "drizzle-orm";

import { db } from "@/db/client";
import {
  alertDeliveries,
  catalysts,
  dismissedCatalysts,
  eventClusters,
  ingestionRuns,
  rawSources,
  vendorFetchState,
} from "@/db/schema";

export interface ClearIngestDataResult {
  clearedAt: string;
  tables: string[];
}

/**
 * Wipe catalyst ingest tables so a fresh fetch can be tested.
 * Keeps users, watchlists, alert rules, companies, and NYSE listings.
 */
export async function clearIngestData(): Promise<ClearIngestDataResult> {
  const tables: string[] = [];

  await db.delete(alertDeliveries).run();
  tables.push("alert_deliveries");

  await db.delete(dismissedCatalysts).run();
  tables.push("dismissed_catalysts");

  // Break cluster FK before dropping catalyst rows.
  await db
    .update(catalysts)
    .set({ clusterId: null })
    .where(isNotNull(catalysts.clusterId))
    .run();

  await db.delete(eventClusters).run();
  tables.push("event_clusters");

  await db.delete(catalysts).run();
  tables.push("catalysts");

  await db.delete(rawSources).run();
  tables.push("raw_sources");

  try {
    await db.delete(vendorFetchState).run();
    tables.push("vendor_fetch_state");
  } catch {
    /* table may be missing on ancient DBs — migrate first */
  }

  try {
    await db.delete(ingestionRuns).run();
    tables.push("ingestion_runs");
  } catch {
    /* ok */
  }

  return { clearedAt: new Date().toISOString(), tables };
}
