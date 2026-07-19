/**
 * Backfills the enrichment columns (headline, event_category, item_codes,
 * company_name) for catalysts ingested before 8-K item parsing existed.
 *
 * Idempotent: only touches rows whose `headline` is still null, and reparses
 * from the raw feed summary we already stored - no new SEC requests.
 *
 * Usage:
 *   npm run backfill:items                      # local.db
 *   LIBSQL_URL=... LIBSQL_AUTH_TOKEN=... npm run backfill:items   # remote Turso
 */
function readStringField(rawContent: unknown, field: string): string | null {
  if (
    typeof rawContent === "object" &&
    rawContent !== null &&
    field in rawContent &&
    typeof (rawContent as Record<string, unknown>)[field] === "string"
  ) {
    return (rawContent as Record<string, string>)[field];
  }
  return null;
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // optional if already in the environment
  }

  const { eq, isNull } = await import("drizzle-orm");
  const { db } = await import("@/db/client");
  const { catalysts, rawSources } = await import("@/db/schema");
  const { parseFilingSummary } = await import("@/lib/jobs/parse-8k-items");

  const rows = await db
    .select({
      id: catalysts.id,
      title: catalysts.title,
      companyName: catalysts.companyName,
      rawContent: rawSources.rawContent,
    })
    .from(catalysts)
    .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
    .where(isNull(catalysts.headline))
    .all();

  if (rows.length === 0) {
    console.log("Nothing to backfill - all catalysts are already enriched.");
    return;
  }

  let updated: number = 0;
  for (const row of rows) {
    const summary: string = readStringField(row.rawContent, "summary") ?? "";
    const { items, primaryCategory, headline } = parseFilingSummary(summary);

    // Legacy rows stored a date-only (midnight) timestamp; recover the precise
    // acceptance time we kept in raw_content so the feed's "age" is real.
    const preciseUpdated: string | null = readStringField(
      row.rawContent,
      "updated",
    );

    await db
      .update(catalysts)
      .set({
        headline,
        eventCategory: primaryCategory,
        itemCodes: items,
        // Derive a company name from the legacy title if the column is empty.
        companyName:
          row.companyName ?? row.title.replace(/ \u2014 .*$/, "").trim(),
        ...(preciseUpdated
          ? { timestamp: new Date(preciseUpdated).toISOString() }
          : {}),
      })
      .where(eq(catalysts.id, row.id))
      .run();
    updated += 1;
  }

  console.log(`Backfilled ${updated} catalyst row(s).`);
}

void main();
