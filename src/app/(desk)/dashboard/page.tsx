import { and, desc, eq, isNotNull, lte, ne } from "drizzle-orm";

import { LiveCatalystFeed } from "@/components/live-catalyst-feed";
import { PageEnter } from "@/components/page-enter";
import { db } from "@/db/client";
import { catalysts, companies, rawSources } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { toFeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import { withDbRetry } from "@/lib/db/with-db-retry";
import { parseDashboardCatalystId } from "@/lib/nav/dashboard-href";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string; c?: string }>;
}) {
  const { ticker, c } = await searchParams;
  const initialSelectedId = parseDashboardCatalystId(c);

  // Auth / DB setup handled by `dashboard/layout.tsx`.
  const user = await getCurrentAppUser();
  if (!user) {
    return null;
  }

  const recentCatalysts = await withDbRetry(() =>
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
        materialityReasons: catalysts.materialityReasons,
        aiBullets: catalysts.aiBullets,
        aiLean: catalysts.aiLean,
        aiUncertain: catalysts.aiUncertain,
        sourceUrl: rawSources.url,
        sourceProvider: rawSources.provider,
        sector: companies.sector,
      })
      .from(catalysts)
      .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
      .leftJoin(companies, eq(catalysts.companyId, companies.id))
      // Exclude scheduled-future calendar entries (macro/earnings/FDA) - see
      // the matching filter + comment in /api/catalysts/route.ts.
      // Match product default: ticker-only tape (hide unresolved names).
      .where(
        and(
          lte(catalysts.timestamp, new Date().toISOString()),
          isNotNull(catalysts.ticker),
          ne(catalysts.ticker, ""),
        ),
      )
      .orderBy(desc(catalysts.timestamp), desc(catalysts.id))
      .limit(200)
      .all(),
  );

  return (
    <PageEnter className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
      <LiveCatalystFeed
        initialCatalysts={recentCatalysts.map(toFeedCatalyst)}
        isAdmin={user.isAdmin}
        initialTickerFilter={ticker?.trim().toUpperCase() || undefined}
        initialSelectedId={initialSelectedId}
      />
    </PageEnter>
  );
}
