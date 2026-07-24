import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

import { db } from "@/db/client";
import { catalysts, companies, rawSources } from "@/db/schema";
import { withDbRetry } from "@/lib/db/with-db-retry";

/**
 * Cached light article metadata (no raw blob). Short TTL so back/forward and
 * re-clicks on the same id skip a cold Turso round-trip while the tape stays fresh.
 */
export async function getCachedCatalystArticleMeta(id: number) {
  return unstable_cache(
    async () =>
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
        { attempts: 3, delayMs: 400 },
      ),
    ["catalyst-article-meta", String(id)],
    { revalidate: 60 },
  )();
}

/** Raw blob is larger / more volatile — shorter TTL, soft-fail at call site. */
export async function getCachedCatalystRawContent(rawSourceId: number) {
  return unstable_cache(
    async () => {
      const row = await withDbRetry(
        () =>
          db
            .select({ rawContent: rawSources.rawContent })
            .from(rawSources)
            .where(eq(rawSources.id, rawSourceId))
            .get(),
        { attempts: 3, delayMs: 400 },
      );
      return row?.rawContent ?? null;
    },
    ["catalyst-raw-content", String(rawSourceId)],
    { revalidate: 30 },
  )();
}
