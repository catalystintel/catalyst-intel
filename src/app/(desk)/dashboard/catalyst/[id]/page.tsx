import { notFound } from "next/navigation";

import { CatalystArticleView } from "@/components/catalyst-article-view";
import { PageEnter } from "@/components/page-enter";
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
  getCachedCatalystArticleMeta,
  getCachedCatalystRawContent,
} from "@/lib/catalysts/article-page-data";
import {
  fetchLatestEarningsForTicker,
  needsEarningsEnrichment,
} from "@/lib/catalysts/enrich-earnings";
import {
  fetchArticleEnrichment,
  type ArticleEnrichment,
} from "@/lib/catalysts/enrich-article";
import { toFeedCatalyst } from "@/lib/catalysts/feed-catalyst";

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

  // Auth / DB setup handled by `dashboard/layout.tsx`.

  const rowMeta = await getCachedCatalystArticleMeta(id);
  if (!rowMeta) {
    notFound();
  }

  let rawContent: unknown = null;
  const rawSourceId = rowMeta.rawSourceId;
  if (rawSourceId != null) {
    try {
      rawContent = await getCachedCatalystRawContent(rawSourceId);
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
  );
}
