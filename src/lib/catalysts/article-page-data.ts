import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { catalysts, companies, rawSources } from "@/db/schema";
import { withTimeBudget } from "@/lib/async/with-time-budget";
import { withDbRetry } from "@/lib/db/with-db-retry";

/**
 * Light article metadata (no raw blob).
 *
 * Intentionally uncached: Vercel Data Cache + Turso inside `unstable_cache`
 * was a reliability footgun on Hobby (extra network hop / serialization),
 * and the Live tape already keeps the desk warm. Keep retries tight so a
 * blip cannot burn the whole serverless budget.
 */
export async function getCatalystArticleMeta(id: number) {
  return withTimeBudget(
    withDbRetry(
      () =>
        db
          .select({
            id: catalysts.id,
            ticker: catalysts.ticker,
            companyName: catalysts.companyName,
            type: catalysts.type,
            title: catalysts.title,
            headline: catalysts.headline,
            eventCategory: catalysts.eventCategory,
            subcategory: catalysts.subcategory,
            itemCodes: catalysts.itemCodes,
            timestamp: catalysts.timestamp,
            summary: catalysts.summary,
            impactScore: catalysts.impactScore,
            confidence: catalysts.confidence,
            tags: catalysts.tags,
            historicalImpact: catalysts.historicalImpact,
            sourceUrl: rawSources.url,
            sourceProvider: rawSources.provider,
            sector: companies.sector,
            rawSourceId: catalysts.rawSourceId,
          })
          .from(catalysts)
          .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
          .leftJoin(companies, eq(catalysts.companyId, companies.id))
          .where(eq(catalysts.id, id))
          .get(),
      { attempts: 2, delayMs: 150 },
    ),
    null,
    2_000,
  );
}

/**
 * Raw vendor blob — can be large (full 8-K JSON). One attempt, hard budget.
 * Callers must soft-fail; the article page still renders from title/summary.
 */
export async function getCatalystRawContent(rawSourceId: number) {
  return withTimeBudget(
    withDbRetry(
      async () => {
        const row = await db
          .select({ rawContent: rawSources.rawContent })
          .from(rawSources)
          .where(eq(rawSources.id, rawSourceId))
          .get();
        return row?.rawContent ?? null;
      },
      { attempts: 1, delayMs: 0 },
    ),
    null,
    800,
  );
}
