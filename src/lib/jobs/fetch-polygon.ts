import { and, desc, eq, isNull, isNotNull } from "drizzle-orm";

import { db } from "@/db/client";
import { catalysts } from "@/db/schema";
import {
  ingestNormalizedCatalysts,
  skippedSourceResult,
  toSourceResult,
  type NormalizedCatalyst,
  type SourceFetchResult,
} from "@/lib/jobs/ingest-pipeline";
import { getPolygonApiKey } from "@/lib/jobs/vendor-env";

const BASE = "https://api.polygon.io";

interface PolygonNewsArticle {
  id?: string;
  title?: string;
  author?: string;
  published_utc?: string;
  article_url?: string;
  description?: string;
  tickers?: string[];
  publisher?: { name?: string };
  insights?: unknown;
}

interface AggBar {
  o?: number;
  c?: number;
  h?: number;
  l?: number;
  v?: number;
  t?: number;
}

async function polygonGet<T>(
  path: string,
  apiKey: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set("apiKey", apiKey);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Polygon ${path} failed (${res.status}): ${body.slice(0, 200) || res.statusText}`,
    );
  }

  return (await res.json()) as T;
}

function newsToNormalized(
  article: PolygonNewsArticle,
): NormalizedCatalyst | null {
  const id = article.id?.trim();
  const title = article.title?.trim();
  if (!id || !title) return null;

  const tickers = (article.tickers ?? [])
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  const ticker = tickers[0] ?? null;
  const publisher = article.publisher?.name?.trim() || "Polygon";
  const timestamp = article.published_utc
    ? new Date(article.published_utc).toISOString()
    : new Date().toISOString();

  return {
    provider: "polygon",
    externalId: `polygon:news:${id}`,
    url: article.article_url ?? null,
    rawContent: article,
    ticker,
    companyName: ticker,
    type: "Benzinga / News",
    title,
    headline: publisher,
    eventCategory: "news",
    subcategory: "benzinga_news",
    timestamp,
    summary: article.description?.trim() || null,
    confidence: 60,
    tags: ["polygon", "benzinga", "news", ...tickers.slice(0, 3)],
  };
}

/**
 * Fetches Polygon (Massive) news — typically includes Benzinga wire —
 * when POLYGON_API_KEY is set. Soft-fails otherwise.
 */
export async function fetchPolygonNews(): Promise<SourceFetchResult> {
  const apiKey = getPolygonApiKey();
  if (!apiKey) {
    return skippedSourceResult(
      "polygon-news",
      "POLYGON_API_KEY is not set. Add it to enable Benzinga/Polygon news ingest.",
    );
  }

  const payload = await polygonGet<{ results?: PolygonNewsArticle[] }>(
    "/v2/reference/news",
    apiKey,
    { limit: "40", order: "desc", sort: "published_utc" },
  );

  const normalized = (payload.results ?? [])
    .map(newsToNormalized)
    .filter((n): n is NormalizedCatalyst => n !== null);

  const result = await ingestNormalizedCatalysts(normalized, { purge: false });
  return toSourceResult("polygon-news", result);
}

function pctChange(open: number, close: number): number {
  if (!Number.isFinite(open) || open === 0) return 0;
  return ((close - open) / open) * 100;
}

/**
 * Enriches recent catalysts that have a ticker with a simple next-session
 * price move from Polygon aggregates. Soft-fails without POLYGON_API_KEY.
 */
export async function enrichHistoricalImpact(options?: {
  limit?: number;
}): Promise<SourceFetchResult> {
  const apiKey = getPolygonApiKey();
  if (!apiKey) {
    return skippedSourceResult(
      "polygon-prices",
      "POLYGON_API_KEY is not set. Add it to enable historical_impact enrichment.",
    );
  }

  const limit = options?.limit ?? 20;
  const candidates = await db
    .select({
      id: catalysts.id,
      ticker: catalysts.ticker,
      timestamp: catalysts.timestamp,
      historicalImpact: catalysts.historicalImpact,
    })
    .from(catalysts)
    .where(and(isNotNull(catalysts.ticker), isNull(catalysts.historicalImpact)))
    .orderBy(desc(catalysts.timestamp))
    .limit(limit)
    .all();

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of candidates) {
    const ticker = row.ticker!.toUpperCase();
    const day = row.timestamp.slice(0, 10);
    try {
      const payload = await polygonGet<{ results?: AggBar[] }>(
        `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${day}/${day}`,
        apiKey,
        { adjusted: "true", limit: "1" },
      );
      const bar = payload.results?.[0];
      if (!bar || bar.o == null || bar.c == null) {
        skipped++;
        continue;
      }

      const impact = {
        provider: "polygon",
        date: day,
        open: bar.o,
        close: bar.c,
        high: bar.h ?? null,
        low: bar.l ?? null,
        volume: bar.v ?? null,
        pctChange: Number(pctChange(bar.o, bar.c).toFixed(3)),
      };

      await db
        .update(catalysts)
        .set({ historicalImpact: impact })
        .where(eq(catalysts.id, row.id))
        .run();
      inserted++;
    } catch {
      errors++;
    }
  }

  return {
    source: "polygon-prices",
    configured: true,
    status: "ok",
    fetched: candidates.length,
    inserted,
    skipped,
    errors,
    ranAt: new Date().toISOString(),
    purgedCatalysts: 0,
    purgedRawSources: 0,
  };
}
