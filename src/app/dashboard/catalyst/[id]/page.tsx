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
import { toFeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

interface PageProps {
  params: Promise<{ id: string }>;
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

  const row = await db
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
      rawContent: rawSources.rawContent,
      sector: companies.sector,
    })
    .from(catalysts)
    .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
    .leftJoin(companies, eq(catalysts.companyId, companies.id))
    .where(eq(catalysts.id, id))
    .get();

  if (!row) {
    notFound();
  }

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

  let enrichedEarnings = null;
  if (
    isEarningsCatalyst(earningsMeta) &&
    row.ticker &&
    needsEarningsEnrichment(row.rawContent)
  ) {
    enrichedEarnings = await fetchLatestEarningsForTicker(row.ticker);
  }

  const detailCards = resolveArticleDetailCards({
    ...earningsMeta,
    enrichedEarnings,
  });

  const whyMoving = deriveWhyMoving({
    summary,
    headline: row.headline,
    title: row.title,
    detailCards,
  });
  const takeaways = deriveTakeaways(summary, body);
  const relatedTickers = extractRelatedTickers(
    row.rawContent,
    row.ticker,
    catalyst.tags,
  );
  const thumbUrl = extractArticleThumbUrl(row.rawContent);
  const deltaSincePublish = parseDeltaSincePublish(row.historicalImpact);

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
        />
      </PageEnter>
    </AppShell>
  );
}
