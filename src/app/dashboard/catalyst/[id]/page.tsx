import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { AppShell } from "@/components/app-shell";
import { CatalystArticleView } from "@/components/catalyst-article-view";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { PageEnter } from "@/components/page-enter";
import { db } from "@/db/client";
import { isLibsqlConfigured } from "@/db/env";
import { catalysts, companies, rawSources } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { withDbRetry } from "@/lib/db/with-db-retry";
import {
  extractArticleBody,
  resolveArticleSummary,
} from "@/lib/catalysts/article-content";
import {
  isEarningsCatalyst,
  resolveArticleDetailCards,
} from "@/lib/catalysts/article-detail";
import {
  deriveTakeaways,
  deriveWhyMoving,
  extractArticleThumbUrl,
  extractRelatedTickers,
  parseDeltaSincePublish,
} from "@/lib/catalysts/article-funnel";
import {
  fetchLatestEarningsForTicker,
  needsEarningsEnrichment,
} from "@/lib/catalysts/enrich-earnings";
import {
  fetchArticleEnrichment,
  type ArticleEnrichment,
} from "@/lib/catalysts/enrich-article";
import { toFeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

interface PageProps {
  params: Promise<{ id: string }>;
}

const EMPTY_ENRICHMENT: ArticleEnrichment = {
  profile: null,
  relatedHeadlines: [],
  quote: null,
};

/** Prefer a partial page over blowing the Hobby function budget on vendors. */
async function withTimeBudget<T>(
  promise: Promise<T>,
  fallback: T,
  budgetMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), budgetMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export default async function CatalystArticlePage({ params }: PageProps) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) {
    notFound();
  }

  if (!isLibsqlConfigured()) {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        redirect(`/login?next=/dashboard/catalyst/${id}`);
      }
    }
    return <DatabaseSetupNotice />;
  }

  const user = await getCurrentAppUser();
  if (!user) {
    redirect(`/login?next=/dashboard/catalyst/${id}`);
  }

  // Light metadata first (same shape as Live tape) — more resilient than
  // hauling `raw_sources.raw_content` in the same round-trip.
  const rowMeta = await withDbRetry(
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
  );

  if (!rowMeta) {
    notFound();
  }

  let rawContent: unknown = null;
  const rawSourceId = rowMeta.rawSourceId;
  if (rawSourceId != null) {
    try {
      const rawRow = await withDbRetry(
        () =>
          db
            .select({ rawContent: rawSources.rawContent })
            .from(rawSources)
            .where(eq(rawSources.id, rawSourceId))
            .get(),
        { attempts: 3, delayMs: 400 },
      );
      rawContent = rawRow?.rawContent ?? null;
    } catch {
      // Soft-fail: summary / title still render if the blob fetch blips.
    }
  }

  const row = { ...rowMeta, rawContent };

  const catalyst = toFeedCatalyst(row);
  const { body, source: bodySource } = extractArticleBody({
    provider: row.sourceProvider,
    rawContent: row.rawContent,
    summary: row.summary,
    title: row.title,
    headline: row.headline,
  });
  const { summary, generated } = resolveArticleSummary({
    summary: row.summary,
    title: row.title,
    headline: row.headline,
    body,
    ticker: row.ticker,
    companyName: row.companyName,
    eventCategory: row.eventCategory,
    subcategory: row.subcategory,
    type: row.type,
    itemCodes: catalyst.items,
    provider: row.sourceProvider,
    rawContent: row.rawContent,
  });

  const earningsMeta = {
    eventCategory: row.eventCategory,
    subcategory: row.subcategory,
    type: row.type,
    headline: row.headline,
    title: row.title,
    ticker: row.ticker,
    companyName: row.companyName,
    provider: row.sourceProvider,
    tags: catalyst.tags,
    itemCodes: catalyst.items,
    rawContent: row.rawContent,
  };

  const shouldFetchEarnings =
    isEarningsCatalyst(earningsMeta) &&
    Boolean(row.ticker) &&
    needsEarningsEnrichment(row.rawContent);

  // Cap vendor wait so a slow Finnhub/Polygon never fails the whole page.
  const [enrichedEarnings, enrichment] = await withTimeBudget(
    Promise.all([
      shouldFetchEarnings && row.ticker
        ? fetchLatestEarningsForTicker(row.ticker)
        : Promise.resolve(null),
      fetchArticleEnrichment({
        ticker: row.ticker,
        excludeCatalystId: row.id,
      }),
    ]),
    [null, EMPTY_ENRICHMENT] as const,
    2_000,
  );

  const detailCards = resolveArticleDetailCards({
    ...earningsMeta,
    enrichedEarnings,
  });

  const deltaSincePublish = parseDeltaSincePublish(row.historicalImpact);

  const whyMoving = deriveWhyMoving({
    summary,
    headline: row.headline,
    title: row.title,
    detailCards,
    delta: deltaSincePublish,
  });
  const takeaways = deriveTakeaways(summary, body);
  const relatedTickers = extractRelatedTickers(
    row.rawContent,
    row.ticker,
    catalyst.tags,
  );
  const thumbUrl = extractArticleThumbUrl(row.rawContent);

  return (
    <AppShell
      user={{
        email: user.email,
        isAdmin: user.isAdmin,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      }}
      active="live"
    >
      <PageEnter className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-5">
        <CatalystArticleView
          catalyst={catalyst}
          summary={summary}
          summaryGenerated={generated}
          body={body}
          bodySource={bodySource}
          detailCards={detailCards}
          whyMoving={whyMoving}
          takeaways={takeaways}
          relatedTickers={relatedTickers}
          thumbUrl={thumbUrl}
          deltaSincePublish={deltaSincePublish}
          enrichment={enrichment}
        />
      </PageEnter>
    </AppShell>
  );
}
