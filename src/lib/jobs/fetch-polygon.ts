import { and, desc, eq, isNull, isNotNull, lt } from "drizzle-orm";

import { db } from "@/db/client";
import {
  catalysts,
  type SentimentLean,
  type SessionContext,
} from "@/db/schema";
import { classifySession } from "@/lib/alerts/session";
import { categorizeNewsHeadline } from "@/lib/catalysts/news-category";
import {
  ingestNormalizedCatalysts,
  skippedSourceResult,
  toSourceResult,
  type NormalizedCatalyst,
  type SourceFetchResult,
} from "@/lib/jobs/ingest-pipeline";
import { getPolygonApiKey } from "@/lib/jobs/vendor-env";

const BASE = "https://api.polygon.io";

/** Free-tier Massive/Polygon REST budget is ~5 req/min; leave headroom for news. */
const DEFAULT_PRICE_ENRICH_LIMIT = 4;

interface PolygonNewsInsight {
  ticker?: string;
  sentiment?: string;
  sentiment_reasoning?: string;
}

interface PolygonNewsArticle {
  id?: string;
  title?: string;
  author?: string;
  published_utc?: string;
  article_url?: string;
  description?: string;
  tickers?: string[];
  publisher?: { name?: string };
  insights?: PolygonNewsInsight[];
}

interface AggBar {
  o?: number;
  c?: number;
  h?: number;
  l?: number;
  v?: number;
  t?: number;
}

export class PolygonHttpError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(path: string, status: number, body: string, statusText: string) {
    super(
      `Polygon ${path} failed (${status}): ${body.slice(0, 200) || statusText}`,
    );
    this.name = "PolygonHttpError";
    this.status = status;
    this.body = body;
  }
}

export function isPolygonRateLimitError(error: unknown): boolean {
  if (!(error instanceof PolygonHttpError)) return false;
  if (error.status === 429) return true;
  return /exceeded the maximum requests per minute/i.test(error.body);
}

export function isPolygonPlanTimeframeError(error: unknown): boolean {
  if (!(error instanceof PolygonHttpError)) return false;
  if (error.status !== 403) return false;
  return (
    /NOT_AUTHORIZED/i.test(error.body) ||
    /doesn't include this data timeframe/i.test(error.body)
  );
}

function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addUtcDays(day: string, delta: number): string {
  const dt = new Date(`${day}T12:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + delta);
  return utcDateString(dt);
}

function isUtcWeekend(day: string): boolean {
  const dow = new Date(`${day}T12:00:00.000Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * Free-tier aggregates reject "today" (and some too-recent windows) with 403
 * NOT_AUTHORIZED timeframe. Use a completed session day: never today; roll
 * Sat/Sun back to Friday.
 */
export function polygonEnrichmentSessionDate(
  eventTimestamp: string,
  now = new Date(),
): string {
  const today = utcDateString(now);
  const eventDay = eventTimestamp.slice(0, 10);
  let day = eventDay < today ? eventDay : addUtcDays(today, -1);
  while (isUtcWeekend(day)) {
    day = addUtcDays(day, -1);
  }
  return day;
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
    throw new PolygonHttpError(path, res.status, body, res.statusText);
  }

  return (await res.json()) as T;
}

function isBenzingaPublisher(name: string): boolean {
  return /benzinga/i.test(name);
}

const SENTIMENT_MAP: Record<string, SentimentLean> = {
  positive: "bullish",
  negative: "bearish",
  neutral: "neutral",
};

/**
 * Polygon news `insights[]` is per-ticker sentiment the vendor already
 * computed but this app previously stored in rawContent and never surfaced.
 * Prefers the insight matching our resolved ticker; falls back to the first.
 */
export function extractSentiment(
  insights: PolygonNewsInsight[] | undefined,
  ticker: string | null,
): { sentiment: SentimentLean; reasoning: string | null } | null {
  if (!insights?.length) return null;

  const match =
    (ticker &&
      insights.find((i) => i.ticker?.trim().toUpperCase() === ticker)) ||
    insights[0];
  if (!match?.sentiment) return null;

  const sentiment = SENTIMENT_MAP[match.sentiment.trim().toLowerCase()];
  if (!sentiment) return null;

  return { sentiment, reasoning: match.sentiment_reasoning?.trim() || null };
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
  const wire = isBenzingaPublisher(publisher);
  const timestamp = article.published_utc
    ? new Date(article.published_utc).toISOString()
    : new Date().toISOString();
  const classified = categorizeNewsHeadline(title);
  const sentiment = extractSentiment(article.insights, ticker);

  return {
    provider: "polygon",
    externalId: `polygon:news:${id}`,
    url: article.article_url ?? null,
    rawContent: {
      ...article,
      wireSource: wire ? "benzinga" : "other",
      publisherName: publisher,
    },
    ticker,
    companyName: ticker,
    type: wire ? "Wire" : "Market News",
    title,
    headline: wire ? "Benzinga Wire" : publisher,
    eventCategory: classified.eventCategory,
    subcategory: wire ? "benzinga_wire" : classified.subcategory,
    timestamp,
    summary: article.description?.trim() || null,
    confidence: wire ? 70 : 60,
    sentiment: sentiment?.sentiment ?? null,
    sentimentReasoning: sentiment?.reasoning ?? null,
    tags: [
      "polygon",
      ...(wire ? (["benzinga", "wire"] as const) : (["news"] as const)),
      ...classified.tags,
      ...tickers.slice(0, 3),
    ],
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
    .filter((n): n is NormalizedCatalyst => n !== null)
    // Quality-first: drop generic news before ingest; gate also enforces this.
    .filter((n) => n.eventCategory !== "news");

  const result = await ingestNormalizedCatalysts(normalized, { purge: false });
  return toSourceResult("polygon-news", result);
}

function pctChange(open: number, close: number): number {
  if (!Number.isFinite(open) || open === 0) return 0;
  return ((close - open) / open) * 100;
}

async function markImpact(
  id: number,
  impact: Record<string, unknown>,
  sessionContext?: SessionContext | null,
): Promise<void> {
  await db
    .update(catalysts)
    .set({
      historicalImpact: impact,
      ...(sessionContext !== undefined ? { sessionContext } : {}),
    })
    .where(eq(catalysts.id, id))
    .run();
}

/**
 * Enriches recent catalysts that have a ticker with a simple session
 * price move from Polygon aggregates. Soft-fails without POLYGON_API_KEY.
 *
 * Free-tier notes (Massive/Polygon Starter):
 * - ~5 REST requests/minute — keep batch small and stop on 429
 * - Same-day / too-recent aggs often return 403 NOT_AUTHORIZED timeframe
 * - Prefer completed sessions (before today UTC); weekends roll to Friday
 */
export async function enrichHistoricalImpact(options?: {
  limit?: number;
  now?: Date;
}): Promise<SourceFetchResult> {
  const apiKey = getPolygonApiKey();
  if (!apiKey) {
    return skippedSourceResult(
      "polygon-prices",
      "POLYGON_API_KEY is not set. Add it to enable historical_impact enrichment.",
    );
  }

  const now = options?.now ?? new Date();
  const todayStart = `${utcDateString(now)}T00:00:00.000Z`;
  const limit = options?.limit ?? DEFAULT_PRICE_ENRICH_LIMIT;

  // Skip "today" rows so free-tier 403 timeframe failures don't monopolize
  // the null-impact queue every cron tick.
  const candidates = await db
    .select({
      id: catalysts.id,
      ticker: catalysts.ticker,
      timestamp: catalysts.timestamp,
      historicalImpact: catalysts.historicalImpact,
      impactScore: catalysts.impactScore,
      materialityReasons: catalysts.materialityReasons,
    })
    .from(catalysts)
    .where(
      and(
        isNotNull(catalysts.ticker),
        isNull(catalysts.historicalImpact),
        lt(catalysts.timestamp, todayStart),
      ),
    )
    .orderBy(desc(catalysts.timestamp))
    .limit(limit)
    .all();

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const notes: string[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i];
    const ticker = row.ticker!.toUpperCase();
    const day = polygonEnrichmentSessionDate(row.timestamp, now);
    try {
      const payload = await polygonGet<{ results?: AggBar[] }>(
        `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${day}/${day}`,
        apiKey,
        { adjusted: "true", limit: "1" },
      );
      const bar = payload.results?.[0];
      if (!bar || bar.o == null || bar.c == null) {
        await markImpact(row.id, {
          provider: "polygon",
          status: "no_bar",
          date: day,
          reason: "No daily aggregate for session date",
        });
        skipped++;
        continue;
      }

      const changePercent = Number(pctChange(bar.o, bar.c).toFixed(3));
      const session = classifySession(row.timestamp);
      const sessionContext: SessionContext = {
        session,
        provider: "polygon",
        date: day,
        price: bar.c,
        changePercent,
        asOf: new Date().toISOString(),
      };

      await markImpact(
        row.id,
        {
          provider: "polygon",
          date: day,
          open: bar.o,
          close: bar.c,
          high: bar.h ?? null,
          low: bar.l ?? null,
          volume: bar.v ?? null,
          pctChange: changePercent,
        },
        sessionContext,
      );

      // A large already-realized move is itself new materiality signal —
      // bump the score post-hoc rather than leaving it stuck at ingest-time.
      if (Math.abs(changePercent) >= 5 && typeof row.impactScore === "number") {
        const bump = Math.abs(changePercent) >= 10 ? 15 : 10;
        const reasons = Array.isArray(row.materialityReasons)
          ? [...(row.materialityReasons as string[])]
          : [];
        reasons.push(
          `Already moved ${changePercent.toFixed(1)}% since publish (+${bump})`,
        );
        await db
          .update(catalysts)
          .set({
            impactScore: Math.min(100, row.impactScore + bump),
            materialityReasons: reasons,
          })
          .where(eq(catalysts.id, row.id))
          .run();
      }

      inserted++;
    } catch (error) {
      if (isPolygonRateLimitError(error)) {
        const remaining = candidates.length - i;
        skipped += remaining;
        notes.push(
          `Rate limited (HTTP 429) after ${i} enrichment attempt(s); deferred ${remaining}. Free tier is ~5 req/min — upgrade or wait for next cron.`,
        );
        break;
      }

      if (isPolygonPlanTimeframeError(error)) {
        await markImpact(row.id, {
          provider: "polygon",
          status: "unavailable",
          date: day,
          reason: "plan_timeframe",
        });
        skipped++;
        if (notes.length < 3) {
          notes.push(
            `Plan timeframe blocked ${ticker} @ ${day} (403 NOT_AUTHORIZED).`,
          );
        }
        continue;
      }

      errors++;
      if (notes.length < 3) {
        notes.push(
          error instanceof Error ? error.message : String(error ?? "failed"),
        );
      }
    }
  }

  return {
    source: "polygon-prices",
    configured: true,
    status: "ok",
    message: notes.length ? notes.join(" ") : undefined,
    fetched: candidates.length,
    inserted,
    skipped,
    errors,
    ranAt: new Date().toISOString(),
    purgedCatalysts: 0,
    purgedRawSources: 0,
  };
}
