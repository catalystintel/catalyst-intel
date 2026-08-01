/**
 * Optional server-side article enrichment for the in-app reader.
 * Soft-fails when vendor keys are unset or requests error — page still works
 * from DB-only content. Light in-memory TTL cache to respect free-tier limits.
 */

import { and, desc, eq, ne } from "drizzle-orm";

import { db } from "@/db/client";
import { isLibsqlConfigured } from "@/db/env";
import { catalysts, rawSources } from "@/db/schema";
import { getFinnhubApiKey, getPolygonApiKey } from "@/lib/jobs/vendor-env";
import { reconcileSessionMove } from "@/lib/market/session-move";
import { toVendorBareSymbol } from "@/lib/market/vendor-symbol";
import { fetchYahooQuote } from "@/lib/market/yahoo-market";

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const POLYGON_BASE = "https://api.polygon.io";
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 150;
const RELATED_LIMIT = 5;
const SYMBOL_RE = /^[A-Z][A-Z0-9.]{0,11}$/;

export interface ArticleCompanyProfile {
  name: string | null;
  symbol: string;
  industry: string | null;
  marketCapMillions: number | null;
  webUrl: string | null;
  exchange: string | null;
  country: string | null;
}

export interface ArticleRelatedHeadline {
  title: string;
  url: string | null;
  publishedAt: string | null;
  source: string | null;
  /** Present when the headline maps to a stored catalyst (in-app Details). */
  catalystId: number | null;
}

export interface ArticleMarketQuote {
  price: number | null;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  provider: "finnhub" | "polygon" | "yahoo";
  asOf: string | null;
}

export interface ArticleEnrichment {
  profile: ArticleCompanyProfile | null;
  relatedHeadlines: ArticleRelatedHeadline[];
  quote: ArticleMarketQuote | null;
}

interface CacheEntry {
  expiresAt: number;
  value: ArticleEnrichment;
}

const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): ArticleEnrichment | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key: string, value: ArticleEnrichment): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest != null) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Test helper — clear enrichment cache between cases. */
export function clearArticleEnrichmentCache(): void {
  cache.clear();
}

function emptyEnrichment(): ArticleEnrichment {
  return { profile: null, relatedHeadlines: [], quote: null };
}

function normalizeSymbol(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const symbol = toVendorBareSymbol(raw);
  return SYMBOL_RE.test(symbol) ? symbol : null;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function finiteOrNull(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

async function finnhubGet<T>(
  path: string,
  apiKey: string,
  params: Record<string, string>,
): Promise<T | null> {
  try {
    const url = new URL(`${FINNHUB_BASE}${path}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    url.searchParams.set("token", apiKey);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      // Keep SSR budgets tight — article page must not wait on vendor blips.
      signal: AbortSignal.timeout(2_500),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function polygonGet<T>(
  path: string,
  apiKey: string,
  params: Record<string, string> = {},
): Promise<T | null> {
  try {
    const url = new URL(`${POLYGON_BASE}${path}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    url.searchParams.set("apiKey", apiKey);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(2_500),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface FinnhubProfileRow {
  symbol?: string;
  name?: string;
  finnhubIndustry?: string;
  marketCapitalization?: number;
  weburl?: string;
  exchange?: string;
  country?: string;
}

interface FinnhubNewsRow {
  headline?: string;
  datetime?: number;
  source?: string;
  url?: string;
  id?: number;
}

interface FinnhubQuoteRow {
  c?: number;
  d?: number;
  dp?: number;
  h?: number;
  l?: number;
  o?: number;
  pc?: number;
  t?: number;
}

interface PolygonNewsArticle {
  title?: string;
  published_utc?: string;
  article_url?: string;
  publisher?: { name?: string };
}

async function fetchProfile(
  symbol: string,
  apiKey: string,
): Promise<ArticleCompanyProfile | null> {
  const row = await finnhubGet<FinnhubProfileRow>("/stock/profile2", apiKey, {
    symbol,
  });
  if (!row?.name && !row?.symbol) return null;
  return {
    name: row.name?.trim() || null,
    symbol: (row.symbol ?? symbol).toUpperCase(),
    industry: row.finnhubIndustry?.trim() || null,
    marketCapMillions: finiteOrNull(row.marketCapitalization),
    webUrl: row.weburl?.trim() || null,
    exchange: row.exchange?.trim() || null,
    country: row.country?.trim() || null,
  };
}

async function fetchFinnhubQuote(
  symbol: string,
  apiKey: string,
): Promise<ArticleMarketQuote | null> {
  const row = await finnhubGet<FinnhubQuoteRow>("/quote", apiKey, { symbol });
  if (!row) return null;
  const price = finiteOrNull(row.c);
  if (price == null || price <= 0) return null;
  const previousClose = finiteOrNull(row.pc);
  const open = finiteOrNull(row.o);
  const move = reconcileSessionMove({
    price,
    previousClose,
    open,
    vendorChange: finiteOrNull(row.d),
    vendorChangePercent: finiteOrNull(row.dp),
  });
  // Drop quotes whose session % is nonsense (stale pc after splits, etc.).
  if (
    move.changePercent == null &&
    finiteOrNull(row.dp) != null &&
    Math.abs(row.dp!) > 50
  ) {
    return null;
  }
  return {
    price,
    change: move.change,
    changePercent: move.changePercent,
    open,
    high: finiteOrNull(row.h),
    low: finiteOrNull(row.l),
    previousClose,
    provider: "finnhub",
    asOf:
      typeof row.t === "number" && row.t > 0
        ? new Date(row.t * 1000).toISOString()
        : null,
  };
}

/**
 * Last completed session vs prior close from daily aggregates.
 * Avoids treating a single bar's open→close as "session change" (that
 * produced fake hundreds-of-percent moves on reverse-split names).
 */
async function fetchPolygonPrevQuote(
  symbol: string,
  apiKey: string,
): Promise<ArticleMarketQuote | null> {
  const to = new Date();
  const from = new Date(to.getTime() - 14 * 86_400_000);
  const fromYmd = from.toISOString().slice(0, 10);
  const toYmd = to.toISOString().slice(0, 10);
  const payload = await polygonGet<{
    results?: Array<{
      o?: number;
      h?: number;
      l?: number;
      c?: number;
      t?: number;
    }>;
  }>(
    `/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${fromYmd}/${toYmd}`,
    apiKey,
    { adjusted: "true", sort: "asc", limit: "15" },
  );
  const bars = payload?.results ?? [];
  if (bars.length === 0) return null;

  const last = bars[bars.length - 1]!;
  const prior = bars.length >= 2 ? bars[bars.length - 2]! : null;
  const close = finiteOrNull(last.c);
  const open = finiteOrNull(last.o);
  if (close == null || close <= 0) return null;

  const previousClose = finiteOrNull(prior?.c) ?? finiteOrNull(last.o);
  const move = reconcileSessionMove({
    price: close,
    previousClose,
    open,
  });

  return {
    price: close,
    change: move.change,
    changePercent: move.changePercent,
    open,
    high: finiteOrNull(last.h),
    low: finiteOrNull(last.l),
    previousClose,
    provider: "polygon",
    asOf:
      typeof last.t === "number" && last.t > 0
        ? new Date(last.t).toISOString()
        : null,
  };
}

async function fetchYahooMarketQuote(
  symbol: string,
): Promise<ArticleMarketQuote | null> {
  const row = await fetchYahooQuote(symbol);
  if (!row) return null;
  return {
    price: row.price,
    change: row.change,
    changePercent: row.changePercent,
    open: row.open,
    high: row.high,
    low: row.low,
    previousClose: row.previousClose,
    provider: "yahoo",
    asOf: row.asOf,
  };
}

async function fetchRelatedFromDb(
  symbol: string,
  excludeId: number | null,
): Promise<ArticleRelatedHeadline[]> {
  if (!isLibsqlConfigured()) return [];

  try {
    const rows = await db
      .select({
        id: catalysts.id,
        title: catalysts.title,
        headline: catalysts.headline,
        timestamp: catalysts.timestamp,
        sourceUrl: rawSources.url,
        sourceProvider: rawSources.provider,
      })
      .from(catalysts)
      .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
      .where(
        excludeId != null
          ? and(eq(catalysts.symbol, symbol), ne(catalysts.id, excludeId))
          : eq(catalysts.symbol, symbol),
      )
      .orderBy(desc(catalysts.timestamp))
      .limit(RELATED_LIMIT)
      .all();

    const out: ArticleRelatedHeadline[] = [];
    for (const row of rows) {
      const title = (row.headline || row.title || "").trim();
      if (!title) continue;
      out.push({
        title,
        url: null,
        publishedAt: row.timestamp || null,
        source: "Catalyst",
        catalystId: row.id,
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchFinnhubCompanyNews(
  symbol: string,
  apiKey: string,
): Promise<ArticleRelatedHeadline[]> {
  const rows = await finnhubGet<FinnhubNewsRow[]>("/company-news", apiKey, {
    symbol,
    from: isoDaysAgo(-14),
    to: isoDaysAgo(0),
  });
  if (!Array.isArray(rows)) return [];

  const out: ArticleRelatedHeadline[] = [];
  for (const row of rows) {
    if (out.length >= RELATED_LIMIT) break;
    const title = row.headline?.trim();
    if (!title) continue;
    out.push({
      title,
      url: null,
      publishedAt:
        typeof row.datetime === "number" && row.datetime > 0
          ? new Date(row.datetime * 1000).toISOString()
          : null,
      source: "Related",
      catalystId: null,
    });
  }
  return out;
}

async function fetchPolygonSymbolNews(
  symbol: string,
  apiKey: string,
): Promise<ArticleRelatedHeadline[]> {
  const payload = await polygonGet<{ results?: PolygonNewsArticle[] }>(
    "/v2/reference/news",
    apiKey,
    {
      symbol: symbol,
      limit: String(RELATED_LIMIT),
      order: "desc",
      sort: "published_utc",
    },
  );

  const out: ArticleRelatedHeadline[] = [];
  for (const article of payload?.results ?? []) {
    if (out.length >= RELATED_LIMIT) break;
    const title = article.title?.trim();
    if (!title) continue;
    out.push({
      title,
      url: null,
      publishedAt: article.published_utc?.trim() || null,
      source: "Related",
      catalystId: null,
    });
  }
  return out;
}

function headlineKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 80);
}

function mergeRelatedHeadlines(
  ...lists: ArticleRelatedHeadline[][]
): ArticleRelatedHeadline[] {
  const seen = new Set<string>();
  const out: ArticleRelatedHeadline[] = [];
  for (const list of lists) {
    for (const item of list) {
      const key = headlineKey(item.title);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= RELATED_LIMIT) return out;
    }
  }
  return out;
}

/**
 * Fetch supporting data for an article keyed by symbol (+ optional exclude id).
 * Always soft-fails to an empty enrichment object.
 */
export async function fetchArticleEnrichment(options: {
  symbol: string | null | undefined;
  excludeCatalystId?: number | null;
}): Promise<ArticleEnrichment> {
  try {
    return await fetchArticleEnrichmentInner(options);
  } catch {
    return emptyEnrichment();
  }
}

async function fetchArticleEnrichmentInner(options: {
  symbol: string | null | undefined;
  excludeCatalystId?: number | null;
}): Promise<ArticleEnrichment> {
  const symbol = normalizeSymbol(options.symbol);
  if (!symbol) return emptyEnrichment();

  const cacheKey = `${symbol}:${options.excludeCatalystId ?? 0}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const finnhubKey = getFinnhubApiKey();
  const polygonKey = getPolygonApiKey();

  const [
    dbRelated,
    profile,
    finnhubNews,
    polygonNews,
    finnhubQuote,
    polygonQuote,
  ] = await Promise.all([
    fetchRelatedFromDb(symbol, options.excludeCatalystId ?? null),
    finnhubKey ? fetchProfile(symbol, finnhubKey) : Promise.resolve(null),
    finnhubKey
      ? fetchFinnhubCompanyNews(symbol, finnhubKey)
      : Promise.resolve([] as ArticleRelatedHeadline[]),
    // Prefer Finnhub news when available; only hit Polygon news if Finnhub key missing.
    !finnhubKey && polygonKey
      ? fetchPolygonSymbolNews(symbol, polygonKey)
      : Promise.resolve([] as ArticleRelatedHeadline[]),
    finnhubKey ? fetchFinnhubQuote(symbol, finnhubKey) : Promise.resolve(null),
    // Polygon prev-day as soft-fail quote fallback / when Finnhub unavailable.
    polygonKey && !finnhubKey
      ? fetchPolygonPrevQuote(symbol, polygonKey)
      : Promise.resolve(null),
  ]);

  // If Finnhub news came back empty but Polygon is configured, fill the gap once.
  let polygonNewsFill: ArticleRelatedHeadline[] = polygonNews;
  if (
    finnhubKey &&
    polygonKey &&
    finnhubNews.length === 0 &&
    dbRelated.length < RELATED_LIMIT
  ) {
    polygonNewsFill = await fetchPolygonSymbolNews(symbol, polygonKey);
  }

  // Quote: Finnhub → Polygon daily → Yahoo (keyless). Never paint absurd %.
  let quote = finnhubQuote;
  if (!quote && polygonKey) {
    quote = polygonQuote ?? (await fetchPolygonPrevQuote(symbol, polygonKey));
  }
  if (!quote) {
    quote = await fetchYahooMarketQuote(symbol);
  }

  const value: ArticleEnrichment = {
    profile,
    relatedHeadlines: mergeRelatedHeadlines(
      dbRelated,
      finnhubNews,
      polygonNewsFill,
    ),
    quote,
  };

  cacheSet(cacheKey, value);
  return value;
}

/**
 * Lightweight quote + profile for the Live tape split panel.
 * Skips related-headline fan-out used by the details enrichment path.
 */
export async function fetchMarketQuoteBundle(options: {
  symbol: string | null | undefined;
}): Promise<{
  quote: ArticleMarketQuote | null;
  profile: ArticleCompanyProfile | null;
}> {
  try {
    const symbol = normalizeSymbol(options.symbol);
    if (!symbol) return { quote: null, profile: null };

    const cacheKey = `quote:${symbol}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      return { quote: cached.quote, profile: cached.profile };
    }

    const finnhubKey = getFinnhubApiKey();
    const polygonKey = getPolygonApiKey();

    const [profile, finnhubQuote, polygonQuote] = await Promise.all([
      finnhubKey ? fetchProfile(symbol, finnhubKey) : Promise.resolve(null),
      finnhubKey
        ? fetchFinnhubQuote(symbol, finnhubKey)
        : Promise.resolve(null),
      polygonKey && !finnhubKey
        ? fetchPolygonPrevQuote(symbol, polygonKey)
        : Promise.resolve(null),
    ]);

    let quote = finnhubQuote;
    if (!quote && polygonKey) {
      quote = polygonQuote ?? (await fetchPolygonPrevQuote(symbol, polygonKey));
    }
    if (!quote) {
      quote = await fetchYahooMarketQuote(symbol);
    }

    const value: ArticleEnrichment = {
      profile,
      relatedHeadlines: [],
      quote,
    };
    cacheSet(cacheKey, value);
    return { quote, profile };
  } catch {
    return { quote: null, profile: null };
  }
}
