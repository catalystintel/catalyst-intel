/**
 * News Feed query — wire / company-news headlines only.
 *
 * Catalyst Feed is the triage blotter (SEC, FDA, halts, calendars, + news).
 * News Feed is the dedicated headline stream: Polygon Wire / Market News and
 * Finnhub classified company news. Identification is by `type` + external id
 * prefix (not eventCategory alone — classified headlines land in earnings,
 * regulatory, etc.).
 */

import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db/client";
import { catalysts, rawSources, type SentimentLean } from "@/db/schema";
import {
  encodeFeedCursor,
  parseFeedCursor,
  type FeedCursor,
} from "@/lib/catalysts/feed-query";
import {
  parseFeedTimeWindow,
  sinceIsoForFeedTimeWindow,
  type FeedTimeWindow,
} from "@/lib/catalysts/feed-time-window";
import {
  isEventCategoryKey,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";

export const NEWS_FEED_PAGE_SIZE = 60;
export const NEWS_FEED_MAX_LIMIT = 150;

/** Catalyst `type` values written by Finnhub + Polygon news ingest. */
export const NEWS_FEED_TYPES = ["Company News", "Wire", "Market News"] as const;

export interface NewsFeedFilters {
  q: string;
  categories: EventCategoryKey[];
  timeWindow: FeedTimeWindow;
  since: string | null;
  until: string;
  /** When set, only these symbols (watchlist filter). */
  symbols: string[];
}

export interface NewsHeadline {
  id: number;
  symbol: string | null;
  companyName: string | null;
  type: string;
  title: string;
  headline: string | null;
  eventCategory: EventCategoryKey | null;
  subcategory: string | null;
  timestamp: string;
  summary: string | null;
  impactScore: number | null;
  sentiment: SentimentLean | null;
  sourceUrl: string | null;
  sourceProvider: string | null;
  externalId: string | null;
}

const SENTIMENT_SET = new Set<SentimentLean>(["bullish", "bearish", "neutral"]);

/** SQL predicate: this row is a wire / company-news headline. */
export function newsFeedIdentitySql(): SQL {
  return or(
    inArray(catalysts.type, [...NEWS_FEED_TYPES]),
    like(rawSources.externalId, "finnhub:news:%"),
    like(rawSources.externalId, "polygon:news:%"),
  )!;
}

export function parseNewsFeedFilters(
  params: URLSearchParams,
  now = Date.now(),
): NewsFeedFilters {
  const timeWindow = parseFeedTimeWindow(params.get("window"));
  const q = (params.get("q") ?? "").trim().toUpperCase();
  const categories = (params.get("categories") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(isEventCategoryKey);
  const symbols = (params.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const sinceParam = params.get("since")?.trim() || null;
  const until = params.get("until")?.trim() || new Date(now).toISOString();

  return {
    q,
    categories,
    timeWindow,
    since: sinceParam ?? sinceIsoForFeedTimeWindow(timeWindow, now),
    until,
    symbols,
  };
}

export function buildNewsFeedWhere(
  filters: NewsFeedFilters,
  options?: { cursor?: FeedCursor | null },
): SQL | undefined {
  const parts: SQL[] = [
    newsFeedIdentitySql(),
    lte(catalysts.timestamp, filters.until),
  ];

  if (filters.since) {
    parts.push(gte(catalysts.timestamp, filters.since));
  }

  if (options?.cursor) {
    const { timestamp, id } = options.cursor;
    parts.push(
      sql`(${catalysts.timestamp} < ${timestamp} OR (${catalysts.timestamp} = ${timestamp} AND ${catalysts.id} < ${id}))`,
    );
  }

  if (filters.q) {
    const pattern = `%${filters.q.replace(/[%_]/g, "")}%`;
    parts.push(
      or(
        like(catalysts.symbol, pattern),
        like(catalysts.companyName, pattern),
        like(catalysts.title, pattern),
        like(catalysts.headline, pattern),
      )!,
    );
  }

  if (filters.categories.length > 0) {
    parts.push(inArray(catalysts.eventCategory, filters.categories));
  }

  if (filters.symbols.length > 0) {
    parts.push(inArray(catalysts.symbol, filters.symbols));
  }

  return and(...parts);
}

const newsSelectFields = {
  id: catalysts.id,
  symbol: catalysts.symbol,
  companyName: catalysts.companyName,
  type: catalysts.type,
  title: catalysts.title,
  headline: catalysts.headline,
  eventCategory: catalysts.eventCategory,
  subcategory: catalysts.subcategory,
  timestamp: catalysts.timestamp,
  summary: catalysts.summary,
  impactScore: catalysts.impactScore,
  sentiment: catalysts.sentiment,
  sourceUrl: rawSources.url,
  sourceProvider: rawSources.provider,
  externalId: rawSources.externalId,
} as const;

function toEventCategory(
  value: string | null | undefined,
): EventCategoryKey | null {
  if (value && isEventCategoryKey(value)) return value;
  return null;
}

function toSentiment(value: string | null | undefined): SentimentLean | null {
  if (!value || !SENTIMENT_SET.has(value as SentimentLean)) return null;
  return value as SentimentLean;
}

export function toNewsHeadline(row: {
  id: number;
  symbol: string | null;
  companyName: string | null;
  type: string;
  title: string;
  headline: string | null;
  eventCategory: string | null;
  subcategory: string | null;
  timestamp: string;
  summary: string | null;
  impactScore: number | null;
  sentiment: string | null;
  sourceUrl: string | null;
  sourceProvider: string | null;
  externalId: string | null;
}): NewsHeadline {
  return {
    id: row.id,
    symbol: row.symbol,
    companyName: row.companyName,
    type: row.type,
    title: row.title,
    headline: row.headline,
    eventCategory: toEventCategory(row.eventCategory),
    subcategory: row.subcategory?.trim() || null,
    timestamp: row.timestamp,
    summary: row.summary,
    impactScore: row.impactScore,
    sentiment: toSentiment(row.sentiment),
    sourceUrl: row.sourceUrl,
    sourceProvider: row.sourceProvider,
    externalId: row.externalId,
  };
}

export async function queryNewsFeedPage(
  filters: NewsFeedFilters,
  options: { cursor?: FeedCursor | null; limit: number },
) {
  const where = buildNewsFeedWhere(filters, { cursor: options.cursor });
  const rows = await db
    .select(newsSelectFields)
    .from(catalysts)
    .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
    .where(where)
    .orderBy(desc(catalysts.timestamp), desc(catalysts.id))
    .limit(options.limit)
    .all();
  return rows.map(toNewsHeadline);
}

export async function queryNewsFeedTotal(
  filters: NewsFeedFilters,
): Promise<number> {
  const where = buildNewsFeedWhere(filters);
  const row = await db
    .select({ n: count() })
    .from(catalysts)
    .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
    .where(where)
    .get();
  return row?.n ?? 0;
}

export { encodeFeedCursor, parseFeedCursor };
export type { FeedCursor };
