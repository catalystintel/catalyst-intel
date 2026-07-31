import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { catalysts, companies, rawSources } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import {
  extractArticleBody,
  extractFilingProofMeta,
  resolveArticleSummary,
} from "@/lib/catalysts/article-content";
import { extractArticleThumbUrl } from "@/lib/catalysts/article-funnel";
import {
  isEarningsCatalyst,
  resolveArticleDetailCards,
} from "@/lib/catalysts/article-detail";
import {
  fetchLatestEarningsForSymbol,
  needsEarningsEnrichment,
} from "@/lib/catalysts/enrich-earnings";
import { fetchArticleEnrichment } from "@/lib/catalysts/enrich-article";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Authenticated single-catalyst payload for the in-app details view.
 * Includes derived summary + body text from stored raw_content.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  if (!isLibsqlConfigured()) {
    return NextResponse.json(
      { error: databaseUnavailableMessage() },
      { status: 503 },
    );
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `catalysts-id:${ip}`,
    ...RATE_LIMITS.catalystsRead,
  });

  if (!limitResult.ok) {
    return rateLimitExceededResponse(limitResult);
  }

  const user = await getCurrentAppUser();
  if (!user) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
      limitResult,
    );
  }

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Invalid catalyst id." }, { status: 400 }),
      limitResult,
    );
  }

  const row = await db
    .select({
      id: catalysts.id,
      symbol: catalysts.symbol,
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
      aiBullets: catalysts.aiBullets,
      aiLean: catalysts.aiLean,
      aiUncertain: catalysts.aiUncertain,
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
    return withRateLimitHeaders(
      NextResponse.json({ error: "Catalyst not found." }, { status: 404 }),
      limitResult,
    );
  }

  const { body, source: bodySource } = extractArticleBody({
    provider: row.sourceProvider,
    rawContent: row.rawContent,
    summary: row.summary,
    title: row.title,
    headline: row.headline,
  });
  const { summary, generated: summaryGenerated } = resolveArticleSummary({
    summary: row.summary,
    title: row.title,
    headline: row.headline,
    body,
    symbol: row.symbol,
    companyName: row.companyName,
    eventCategory: row.eventCategory,
    subcategory: row.subcategory,
    type: row.type,
    itemCodes: Array.isArray(row.itemCodes)
      ? (row.itemCodes as Array<{
          code?: string | null;
          label?: string | null;
        }>)
      : null,
    provider: row.sourceProvider,
    rawContent: row.rawContent,
  });

  const tags = Array.isArray(row.tags)
    ? row.tags.filter((t): t is string => typeof t === "string")
    : [];
  const itemCodes = Array.isArray(row.itemCodes)
    ? (row.itemCodes as Array<{ code?: string | null; label?: string | null }>)
    : null;

  const detailInput = {
    eventCategory: row.eventCategory,
    subcategory: row.subcategory,
    type: row.type,
    headline: row.headline,
    title: row.title,
    symbol: row.symbol,
    companyName: row.companyName,
    provider: row.sourceProvider,
    tags,
    itemCodes,
    rawContent: row.rawContent,
  };

  let enrichedEarnings = null;
  if (
    isEarningsCatalyst(detailInput) &&
    row.symbol &&
    needsEarningsEnrichment(row.rawContent)
  ) {
    enrichedEarnings = await fetchLatestEarningsForSymbol(row.symbol);
  }

  const detailCards = resolveArticleDetailCards({
    ...detailInput,
    enrichedEarnings,
  });

  const enrichment = await fetchArticleEnrichment({
    symbol: row.symbol,
    excludeCatalystId: row.id,
  });

  const catalyst = {
    id: row.id,
    symbol: row.symbol,
    companyName: row.companyName,
    type: row.type,
    title: row.title,
    headline: row.headline,
    eventCategory: row.eventCategory,
    subcategory: row.subcategory,
    itemCodes: row.itemCodes,
    timestamp: row.timestamp,
    summary: row.summary,
    impactScore: row.impactScore,
    confidence: row.confidence,
    tags: row.tags,
    historicalImpact: row.historicalImpact,
    aiBullets: row.aiBullets,
    aiLean: row.aiLean,
    aiUncertain: row.aiUncertain,
    sourceUrl: row.sourceUrl,
    sourceProvider: row.sourceProvider,
    sector: row.sector,
    rawContent: row.rawContent,
  };

  return withRateLimitHeaders(
    NextResponse.json({
      catalyst,
      article: {
        summary,
        summaryGenerated,
        body,
        bodySource,
        detailCards,
        enrichment,
        filingProofMeta: extractFilingProofMeta(row.rawContent),
        thumbUrl: extractArticleThumbUrl(row.rawContent),
      },
    }),
    limitResult,
  );
}
