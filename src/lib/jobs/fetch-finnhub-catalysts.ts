import {
  ingestNormalizedCatalysts,
  skippedSourceResult,
  toSourceResult,
  type NormalizedCatalyst,
  type SourceFetchResult,
} from "@/lib/jobs/ingest-pipeline";
import { getFinnhubApiKey } from "@/lib/jobs/vendor-env";
import { categorizeNewsHeadline } from "@/lib/catalysts/news-category";

const BASE = "https://finnhub.io/api/v1";

interface EarningsRow {
  date?: string;
  epsActual?: number | null;
  epsEstimate?: number | null;
  hour?: string;
  quarter?: number;
  revenueActual?: number | null;
  revenueEstimate?: number | null;
  symbol?: string;
  year?: number;
}

interface FdaRow {
  symbol?: string;
  company?: string;
  drug?: string;
  indication?: string;
  catalyst?: string;
  status?: string;
  date?: string;
}

interface NewsRow {
  category?: string;
  datetime?: number;
  headline?: string;
  id?: number;
  related?: string;
  source?: string;
  summary?: string;
  url?: string;
}

interface ProfileRow {
  ticker?: string;
  name?: string;
  finnhubIndustry?: string;
  marketCapitalization?: number;
  weburl?: string;
}

interface RecommendationRow {
  buy?: number;
  hold?: number;
  period?: string;
  sell?: number;
  strongBuy?: number;
  strongSell?: number;
  symbol?: string;
}

interface PriceTargetRow {
  lastUpdated?: string;
  symbol?: string;
  targetHigh?: number;
  targetLow?: number;
  targetMean?: number;
  targetMedian?: number;
}

/** Fallback liquid names when earnings calendar is empty (free-tier probe). */
const DEFAULT_ANALYST_SYMBOLS = ["AAPL", "MSFT", "NVDA", "AMZN", "META"];

async function finnhubGet<T>(
  path: string,
  apiKey: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set("token", apiKey);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Finnhub ${path} failed (${res.status}): ${body.slice(0, 200) || res.statusText}`,
    );
  }

  return (await res.json()) as T;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNowIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function earningsToNormalized(row: EarningsRow): NormalizedCatalyst | null {
  const symbol = row.symbol?.trim().toUpperCase();
  if (!symbol || !row.date) return null;

  const hour = row.hour?.trim() || "unknown";
  const externalId = `finnhub:earnings:${symbol}:${row.date}:${hour}`;

  return {
    provider: "finnhub",
    externalId,
    url: `https://finnhub.io/quote/${symbol}`,
    rawContent: row,
    ticker: symbol,
    companyName: symbol,
    type: "Earnings",
    title: `${symbol} — Earnings ${row.date}`,
    headline: "Earnings calendar",
    eventCategory: "earnings",
    subcategory: hour === "bmo" || hour === "amc" ? hour : "earnings_calendar",
    timestamp: new Date(`${row.date}T12:00:00.000Z`).toISOString(),
    summary: [
      row.epsEstimate != null ? `EPS est ${row.epsEstimate}` : null,
      row.revenueEstimate != null ? `Rev est ${row.revenueEstimate}` : null,
      hour !== "unknown" ? hour.toUpperCase() : null,
    ]
      .filter(Boolean)
      .join(" · "),
    confidence: 70,
    tags: ["finnhub", "earnings", hour],
  };
}

function fdaToNormalized(row: FdaRow): NormalizedCatalyst | null {
  const symbol = row.symbol?.trim().toUpperCase() || null;
  const date = row.date?.trim();
  if (!date) return null;

  const drug = row.drug?.trim() || "FDA event";
  const key = `${symbol ?? "UNK"}:${date}:${drug}`.toLowerCase();
  const externalId = `finnhub:fda:${key}`;

  return {
    provider: "finnhub",
    externalId,
    url: null,
    rawContent: row,
    ticker: symbol,
    companyName: row.company?.trim() || symbol,
    type: "FDA Calendar",
    title: `${symbol ?? row.company ?? "Issuer"} — ${drug}`,
    headline: row.catalyst?.trim() || "FDA catalyst",
    eventCategory: "regulatory",
    subcategory: "fda_calendar",
    timestamp: new Date(`${date}T12:00:00.000Z`).toISOString(),
    summary: [row.indication, row.status].filter(Boolean).join(" · ") || null,
    confidence: 65,
    tags: ["finnhub", "fda", "regulatory"],
  };
}

function newsToNormalized(row: NewsRow): NormalizedCatalyst | null {
  if (!row.id || !row.headline) return null;
  const related = row.related
    ?.split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const ticker = related?.[0] ?? null;
  const timestamp = row.datetime
    ? new Date(row.datetime * 1000).toISOString()
    : new Date().toISOString();
  const classified = categorizeNewsHeadline(row.headline, row.category);

  return {
    provider: "finnhub",
    externalId: `finnhub:news:${row.id}`,
    url: row.url ?? null,
    rawContent: row,
    ticker,
    companyName: ticker,
    type: "Company News",
    title: row.headline,
    headline: row.source?.trim() || "Company news",
    eventCategory: classified.eventCategory,
    subcategory: classified.subcategory,
    timestamp,
    summary: row.summary?.trim() || null,
    confidence: 55,
    tags: [
      "finnhub",
      "news",
      ...classified.tags,
      ...(related ?? []).slice(0, 3),
    ],
  };
}

/** @internal exported for unit tests */
export function recommendationToNormalized(
  symbol: string,
  row: RecommendationRow,
): NormalizedCatalyst | null {
  const period = row.period?.trim();
  if (!period) return null;

  const strongBuy = row.strongBuy ?? 0;
  const buy = row.buy ?? 0;
  const hold = row.hold ?? 0;
  const sell = row.sell ?? 0;
  const strongSell = row.strongSell ?? 0;
  const bullish = strongBuy + buy;
  const bearish = sell + strongSell;
  const stance =
    bullish > bearish + hold
      ? "Bullish skew"
      : bearish > bullish + hold
        ? "Bearish skew"
        : "Mixed / hold-heavy";

  return {
    provider: "finnhub",
    externalId: `finnhub:rec:${symbol}:${period}`,
    url: `https://finnhub.io/quote/${symbol}`,
    rawContent: { ...row, symbol },
    ticker: symbol,
    companyName: symbol,
    type: "Analyst Actions",
    title: `${symbol} — Recommendation trend (${period})`,
    headline: "Analyst ratings (consensus)",
    eventCategory: "analyst",
    subcategory: "recommendation_trend",
    timestamp: new Date(`${period}T12:00:00.000Z`).toISOString(),
    summary: `${stance} · SB ${strongBuy} / Buy ${buy} / Hold ${hold} / Sell ${sell} / SS ${strongSell}`,
    confidence: 60,
    tags: [
      "finnhub",
      "analyst",
      "ratings",
      "recommendation",
      "bz:analyst_ratings",
    ],
  };
}

/** @internal exported for unit tests */
export function priceTargetToNormalized(
  symbol: string,
  row: PriceTargetRow,
): NormalizedCatalyst | null {
  if (
    row.targetMean == null &&
    row.targetMedian == null &&
    row.targetHigh == null
  ) {
    return null;
  }
  const updated = row.lastUpdated?.trim() || todayIsoDate();
  const mean = row.targetMean;
  const median = row.targetMedian;

  return {
    provider: "finnhub",
    externalId: `finnhub:pt:${symbol}:${updated}`,
    url: `https://finnhub.io/quote/${symbol}`,
    rawContent: { ...row, symbol },
    ticker: symbol,
    companyName: symbol,
    type: "Analyst Actions",
    title: `${symbol} — Price target`,
    headline: "Price target (Street)",
    eventCategory: "analyst",
    subcategory: "price_target",
    timestamp: new Date(`${updated}T12:00:00.000Z`).toISOString(),
    summary: [
      mean != null ? `Mean $${mean}` : null,
      median != null ? `Median $${median}` : null,
      row.targetHigh != null ? `High $${row.targetHigh}` : null,
      row.targetLow != null ? `Low $${row.targetLow}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    confidence: 58,
    tags: ["finnhub", "analyst", "price_target", "bz:analyst_ratings"],
  };
}

function uniqueSymbols(
  rows: Array<{ symbol?: string }>,
  extras: string[],
  limit: number,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of [...rows, ...extras.map((symbol) => ({ symbol }))]) {
    const sym = row.symbol?.trim().toUpperCase();
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);
    out.push(sym);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Finnhub earnings + FDA calendars, company/general news, and partial
 * Analyst Actions (recommendation trends + price targets on free tier).
 * Soft-fails when FINNHUB_API_KEY is unset.
 */
export async function fetchFinnhubCatalysts(options?: {
  newsSymbols?: string[];
  analystSymbols?: string[];
}): Promise<SourceFetchResult> {
  const apiKey = getFinnhubApiKey();
  if (!apiKey) {
    return skippedSourceResult(
      "finnhub",
      "FINNHUB_API_KEY is not set. Add it to enable Finnhub earnings/FDA/news/analyst ingest.",
    );
  }

  const from = todayIsoDate();
  const to = daysFromNowIso(14);
  const normalized: NormalizedCatalyst[] = [];

  const earningsPayload = await finnhubGet<{
    earningsCalendar?: EarningsRow[];
  }>("/calendar/earnings", apiKey, { from, to });
  const earnings = earningsPayload.earningsCalendar ?? [];
  for (const row of earnings.slice(0, 80)) {
    const item = earningsToNormalized(row);
    if (item) normalized.push(item);
  }

  // FDA calendar endpoint varies by plan; soft-catch 403/404.
  try {
    const fdaPayload = await finnhubGet<FdaRow[] | { data?: FdaRow[] }>(
      "/fda-calendar",
      apiKey,
    );
    const fdaRows = Array.isArray(fdaPayload)
      ? fdaPayload
      : (fdaPayload.data ?? []);
    for (const row of fdaRows.slice(0, 40)) {
      const item = fdaToNormalized(row);
      if (item) normalized.push(item);
    }
  } catch (error) {
    console.warn(
      "Finnhub FDA calendar unavailable:",
      error instanceof Error ? error.message : error,
    );
  }

  const newsSymbols = options?.newsSymbols?.slice(0, 5) ?? [];
  if (newsSymbols.length === 0) {
    // Market news fallback when no watchlist symbols provided.
    try {
      const general = await finnhubGet<NewsRow[]>("/news", apiKey, {
        category: "general",
      });
      for (const row of (general ?? []).slice(0, 25)) {
        const item = newsToNormalized(row);
        if (item) normalized.push(item);
      }
    } catch (error) {
      console.warn(
        "Finnhub general news unavailable:",
        error instanceof Error ? error.message : error,
      );
    }
  } else {
    for (const symbol of newsSymbols) {
      try {
        const companyNews = await finnhubGet<NewsRow[]>(
          "/company-news",
          apiKey,
          { symbol, from: daysFromNowIso(-3), to: from },
        );
        for (const row of (companyNews ?? []).slice(0, 10)) {
          const item = newsToNormalized(row);
          if (item) normalized.push(item);
        }

        const profile = await finnhubGet<ProfileRow>(
          "/stock/profile2",
          apiKey,
          {
            symbol,
          },
        );
        if (profile?.name && profile.ticker) {
          // Profile is enrichment metadata stored as a low-priority catalyst note
          // only when we have no better signal — skip inserting profile-only rows.
          void profile;
        }
      } catch (error) {
        console.warn(
          `Finnhub news/profile for ${symbol} failed:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  // Partial Analyst Actions: recommendation trends + price targets (free tier).
  // Cap symbols to stay inside Finnhub rate limits during cron.
  const analystSymbols =
    options?.analystSymbols?.slice(0, 8) ??
    uniqueSymbols(earnings, DEFAULT_ANALYST_SYMBOLS, 8);

  for (const symbol of analystSymbols) {
    try {
      const recs = await finnhubGet<RecommendationRow[]>(
        "/stock/recommendation",
        apiKey,
        { symbol },
      );
      const latest = (recs ?? [])[0];
      if (latest) {
        const item = recommendationToNormalized(symbol, latest);
        if (item) normalized.push(item);
      }
    } catch (error) {
      console.warn(
        `Finnhub recommendation for ${symbol} unavailable:`,
        error instanceof Error ? error.message : error,
      );
    }

    try {
      const pt = await finnhubGet<PriceTargetRow>(
        "/stock/price-target",
        apiKey,
        { symbol },
      );
      const item = priceTargetToNormalized(symbol, pt);
      if (item) normalized.push(item);
    } catch (error) {
      console.warn(
        `Finnhub price-target for ${symbol} unavailable:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  const result = await ingestNormalizedCatalysts(normalized, { purge: false });
  return toSourceResult("finnhub", result);
}
