/**
 * Wipe local SQLite catalysts/raw, fetch all sources (with SEC enrich), then
 * keep only events from the last N hours for local inspection.
 *
 * Usage: npx tsx scripts/local-refresh-window.ts [hours=72]
 *
 * Stubs `server-only` so CLI scripts can import the DB client outside Next.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("module") as typeof import("module") & {
  prototype: { require: (...args: unknown[]) => unknown };
};
const originalRequire = Module.prototype.require;
Module.prototype.require = function (
  this: NodeModule,
  id: string,
  ...rest: unknown[]
) {
  if (id === "server-only") return {};
  return originalRequire.apply(this, [id, ...rest] as never);
};

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // optional
  }

  const hours = Math.max(1, Number(process.argv[2] ?? 72) || 72);
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { db } = await import("@/db/client");
  const { catalysts, rawSources, vendorFetchState, ingestionRuns } =
    await import("@/db/schema");
  const { fetchAllCatalystSources } =
    await import("@/lib/jobs/fetch-all-sources");
  const { lt, sql } = await import("drizzle-orm");

  console.log(`[local-refresh] clearing catalysts + raw_sources…`);
  try {
    await db.delete(ingestionRuns).run();
  } catch {
    /* ok */
  }
  await db.delete(catalysts).run();
  await db.delete(rawSources).run();
  try {
    await db.delete(vendorFetchState).run();
  } catch {
    /* ok */
  }

  console.log(`[local-refresh] fetching all sources (SEC enrich enabled)…`);
  const result = await fetchAllCatalystSources();
  console.log(
    `[local-refresh] fetch totals inserted=${result.totals.inserted} skipped=${result.totals.skipped} errors=${result.totals.errors}`,
  );
  for (const s of result.sources) {
    console.log(
      `  ${s.source}: ${s.status} +${s.inserted}/skip${s.skipped}/err${s.errors}${s.message ? ` — ${s.message}` : ""}`,
    );
  }

  console.log(
    `[local-refresh] trimming to last ${hours}h (timestamp >= ${cutoff})…`,
  );
  const before = await db
    .select({ n: sql<number>`count(*)` })
    .from(catalysts)
    .get();
  await db.delete(catalysts).where(lt(catalysts.timestamp, cutoff)).run();

  await db.run(
    sql`DELETE FROM raw_sources WHERE id NOT IN (SELECT raw_source_id FROM catalysts WHERE raw_source_id IS NOT NULL)`,
  );

  const after = await db
    .select({ n: sql<number>`count(*)` })
    .from(catalysts)
    .get();

  const byProvider = await db
    .select({
      provider: rawSources.provider,
      n: sql<number>`count(*)`,
    })
    .from(rawSources)
    .groupBy(rawSources.provider)
    .all();

  const sample = await db
    .select({
      type: catalysts.type,
      title: catalysts.title,
      summary: catalysts.summary,
      provider: rawSources.provider,
    })
    .from(catalysts)
    .innerJoin(rawSources, sql`${catalysts.rawSourceId} = ${rawSources.id}`)
    .where(sql`${rawSources.provider} = 'sec-edgar'`)
    .limit(5)
    .all();

  console.log(
    `[local-refresh] catalysts ${before?.n ?? "?"} → ${after?.n ?? "?"} (last ${hours}h)`,
  );

  const { getSecUserAgent } = await import("@/lib/jobs/sec-edgar-http");
  const { backfillSecFilingExtractsFromDb } =
    await import("@/lib/jobs/enrich-sec-filings");
  console.log(
    `[local-refresh] backfilling SEC primary-doc extracts (up to 200)…`,
  );
  const backfill = await backfillSecFilingExtractsFromDb({
    userAgent: getSecUserAgent(),
    limit: 200,
    mode: "primary",
  });
  console.log(
    `[local-refresh] SEC backfill scanned=${backfill.scanned} enriched=${backfill.enriched}`,
  );

  console.log(`[local-refresh] raw_sources by provider:`);
  for (const row of byProvider) {
    console.log(`  ${row.provider}: ${row.n}`);
  }
  if (sample.length) {
    console.log(`[local-refresh] SEC sample titles/summaries:`);
    for (const row of sample) {
      console.log(`  [${row.type}] ${row.title}`);
      console.log(`    ${(row.summary ?? "").slice(0, 160)}`);
    }
  }
  console.log(`[local-refresh] done. Open http://localhost:3000/catalyst-feed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
