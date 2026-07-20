import {
  ingestNormalizedCatalysts,
  skippedSourceResult,
  toSourceResult,
  type NormalizedCatalyst,
  type SourceFetchResult,
} from "@/lib/jobs/ingest-pipeline";
import { getFinnhubApiKey } from "@/lib/jobs/vendor-env";

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
    eventCategory: "news",
    subcategory: row.category?.trim() || "company_news",
    timestamp,
    summary: row.summary?.trim() || null,
    confidence: 55,
    tags: ["finnhub", "news", ...(related ?? []).slice(0, 3)],
  };
}

/**
 * Finnhub earnings + FDA calendars, general/company news sample, and a
 * light profile upsert path (profiles enrich company names when present).
 * Soft-fails when FINNHUB_API_KEY is unset.
 */
export async function fetchFinnhubCatalysts(options?: {
  newsSymbols?: string[];
}): Promise<SourceFetchResult> {
  const apiKey = getFinnhubApiKey();
  if (!apiKey) {
    return skippedSourceResult(
      "finnhub",
      "FINNHUB_API_KEY is not set. Add it to enable Finnhub earnings/FDA/news ingest.",
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

  const result = await ingestNormalizedCatalysts(normalized, { purge: false });
  return toSourceResult("finnhub", result);
}
