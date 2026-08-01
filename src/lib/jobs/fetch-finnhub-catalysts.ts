import {
  earningsQuarterLabel,
  formatAnalystRatingTitle,
  formatEarningsReportTitle,
  formatFdaApprovalTitle,
  formatPriceTargetTitle,
  resolveDisplayCompanyName,
} from "@/lib/catalysts/catalyst-titles";
import {
  epsSurprisePctFrom,
  MATERIAL_EPS_SURPRISE_PCT,
} from "@/lib/catalysts/earnings-surprise";
import { categorizeNewsHeadline } from "@/lib/catalysts/news-category";
import {
  formatSeekingAlphaTitle,
  isSeekingAlphaSource,
} from "@/lib/catalysts/seeking-alpha-titles";
import { RETENTION_DAYS } from "@/lib/jobs/data-retention";
import {
  ingestNormalizedCatalysts,
  skippedSourceResult,
  toSourceResult,
  type NormalizedCatalyst,
  type SourceFetchResult,
} from "@/lib/jobs/ingest-pipeline";
import { getFinnhubApiKey } from "@/lib/jobs/vendor-env";
import {
  getCompanyName,
  upsertCompanyProfile,
} from "@/lib/jobs/company-enrichment";

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

/** Wire shape from Finnhub /stock/profile2 — vendor field is `ticker`. */
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

interface CompanyNewsRow {
  category?: string;
  datetime?: number;
  headline?: string;
  id?: number;
  image?: string;
  related?: string;
  source?: string;
  summary?: string;
  url?: string;
}

interface IpoRow {
  date?: string;
  exchange?: string;
  name?: string;
  numberOfShares?: number;
  price?: string | number;
  status?: string;
  symbol?: string;
  totalSharesValue?: number;
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

function todayIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function daysFromIso(days: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysAgoIso(days: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** @internal exported for unit tests. */
export function earningsToNormalized(
  row: EarningsRow,
  companyName?: string | null,
): NormalizedCatalyst | null {
  const symbol = row.symbol?.trim().toUpperCase();
  if (!symbol || !row.date) return null;

  const hour = row.hour?.trim() || "unknown";
  const externalId = `finnhub:earnings:${symbol}:${row.date}:${hour}`;
  const displayName = resolveDisplayCompanyName(companyName, symbol);
  const quarter = earningsQuarterLabel(row.quarter, row.date);
  const displayTitle = formatEarningsReportTitle(quarter, displayName);
  const surprisePct = epsSurprisePctFrom(row.epsActual, row.epsEstimate);
  const rawContent =
    surprisePct != null ? { ...row, epsSurprisePercent: surprisePct } : row;

  return {
    provider: "finnhub",
    externalId,
    url: `https://finnhub.io/quote/${symbol}`,
    rawContent,
    symbol: symbol,
    companyName: displayName,
    type: "Earnings",
    title: displayTitle,
    headline: displayTitle,
    eventCategory: "earnings",
    subcategory: hour === "bmo" || hour === "amc" ? hour : "earnings_calendar",
    timestamp: new Date(`${row.date}T12:00:00.000Z`).toISOString(),
    summary: [
      row.epsActual != null ? `EPS ${row.epsActual}` : null,
      row.epsEstimate != null ? `est ${row.epsEstimate}` : null,
      surprisePct != null
        ? `surprise ${surprisePct > 0 ? "+" : ""}${surprisePct.toFixed(1)}%`
        : null,
      row.revenueEstimate != null ? `Rev est ${row.revenueEstimate}` : null,
      hour !== "unknown" ? hour.toUpperCase() : null,
    ]
      .filter(Boolean)
      .join(" · "),
    confidence: 70,
    tags: [
      "earnings",
      hour,
      quarter,
      ...(surprisePct != null &&
      Math.abs(surprisePct) >= MATERIAL_EPS_SURPRISE_PCT
        ? (["earnings_surprise"] as const)
        : []),
    ],
  };
}

function looksLikeFdaApproval(row: FdaRow): boolean {
  const blob = [row.catalyst, row.status, row.drug]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /\bapprov/.test(blob);
}

/** @internal exported for unit tests. */
export function fdaToNormalized(row: FdaRow): NormalizedCatalyst | null {
  const symbol = row.symbol?.trim().toUpperCase() || null;
  const date = row.date?.trim();
  if (!date) return null;

  const drug = row.drug?.trim() || "FDA event";
  const key = `${symbol ?? "UNK"}:${date}:${drug}`.toLowerCase();
  const externalId = `finnhub:fda:${key}`;
  const companyName = resolveDisplayCompanyName(row.company?.trim(), symbol);
  const isApproval = looksLikeFdaApproval(row);

  return {
    provider: "finnhub",
    externalId,
    url: null,
    rawContent: row,
    symbol: symbol,
    companyName,
    type: isApproval ? "FDA Approval" : "FDA Calendar",
    title: isApproval
      ? formatFdaApprovalTitle(companyName)
      : `${companyName} — ${drug}`,
    headline: isApproval
      ? formatFdaApprovalTitle(companyName)
      : row.catalyst?.trim() || "FDA catalyst",
    eventCategory: "regulatory",
    subcategory: isApproval ? "fda_approval" : "fda_calendar",
    timestamp: new Date(`${date}T12:00:00.000Z`).toISOString(),
    summary: [row.indication, row.status].filter(Boolean).join(" · ") || null,
    confidence: 65,
    tags: ["fda", "regulatory", ...(isApproval ? ["approval"] : [])],
  };
}

/** @internal exported for unit tests — not ingested (quality-first). */
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
    symbol: symbol,
    companyName: symbol,
    type: "Analyst Actions",
    title: formatAnalystRatingTitle(symbol),
    headline: "Analyst ratings (consensus)",
    eventCategory: "analyst",
    subcategory: "recommendation_trend",
    timestamp: new Date(`${period}T12:00:00.000Z`).toISOString(),
    summary: `${stance} · ${period} · SB ${strongBuy} / Buy ${buy} / Hold ${hold} / Sell ${sell} / SS ${strongSell}`,
    confidence: 60,
    tags: ["analyst", "ratings", "recommendation", "bz:analyst_ratings"],
  };
}

/** @internal exported for unit tests and ingest when within retention window. */
export function priceTargetToNormalized(
  symbol: string,
  row: PriceTargetRow,
  options?: { now?: Date; retentionDays?: number },
): NormalizedCatalyst | null {
  const updated = row.lastUpdated?.trim();
  if (!updated) return null;

  const now = options?.now ?? new Date();
  const retentionDays = options?.retentionDays ?? RETENTION_DAYS;
  const updatedDate = new Date(`${updated}T12:00:00.000Z`);
  if (Number.isNaN(updatedDate.getTime())) return null;

  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  if (updatedDate < cutoff) return null;

  if (
    row.targetMean == null &&
    row.targetMedian == null &&
    row.targetHigh == null
  ) {
    return null;
  }

  const mean = row.targetMean;
  const median = row.targetMedian;

  return {
    provider: "finnhub",
    externalId: `finnhub:pt:${symbol}:${updated}`,
    url: `https://finnhub.io/quote/${symbol}`,
    rawContent: { ...row, symbol },
    symbol: symbol,
    companyName: symbol,
    type: "Analyst Actions",
    title: formatPriceTargetTitle(symbol),
    headline: "Price target (Street)",
    eventCategory: "analyst",
    subcategory: "price_target",
    timestamp: updatedDate.toISOString(),
    summary: [
      mean != null ? `Mean $${mean}` : null,
      median != null ? `Median $${median}` : null,
      row.targetHigh != null ? `High $${row.targetHigh}` : null,
      row.targetLow != null ? `Low $${row.targetLow}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    confidence: 58,
    tags: ["analyst", "price_target", "bz:analyst_ratings"],
  };
}

/** Classified Finnhub company news — generic `news` category is dropped. */
export function companyNewsToNormalized(
  row: CompanyNewsRow,
  fallbackSymbol?: string,
): NormalizedCatalyst | null {
  const headline = row.headline?.trim();
  if (!headline) return null;

  const relatedFirst = row.related?.split(",")[0]?.trim().toUpperCase();
  const symbol = relatedFirst || fallbackSymbol?.trim().toUpperCase() || null;
  const classified = categorizeNewsHeadline(headline, row.category);
  if (classified.eventCategory === "news") return null;

  const ts =
    row.datetime != null && row.datetime > 0
      ? new Date(row.datetime * 1000).toISOString()
      : new Date().toISOString();
  const id =
    row.id != null
      ? String(row.id)
      : `${symbol ?? "UNK"}:${ts}:${headline.slice(0, 40)}`.toLowerCase();

  const source = row.source?.trim() || "Company news";
  const summary = row.summary?.trim() || null;
  const title = isSeekingAlphaSource(source)
    ? formatSeekingAlphaTitle({
        title: headline,
        summary,
        companyName: symbol,
        symbol,
        eventCategory: classified.eventCategory,
        subcategory: classified.subcategory,
      })
    : headline;

  return {
    provider: "finnhub",
    externalId: `finnhub:news:${id}`,
    url: row.url ?? null,
    rawContent: {
      id: row.id ?? null,
      headline,
      summary,
      datetime: row.datetime ?? null,
      related: row.related ?? null,
      category: row.category ?? null,
      // Omit vendor `source` / publisher origin from persisted raw.
    },
    symbol: symbol,
    companyName: symbol,
    type: "Company News",
    title,
    headline: null,
    eventCategory: classified.eventCategory,
    subcategory: classified.subcategory,
    timestamp: ts,
    summary,
    confidence: 62,
    tags: ["news", ...classified.tags, ...(symbol ? [symbol] : [])],
  };
}

/** Finnhub IPO calendar row → capital / ipo* subcategories. */
export function ipoToNormalized(row: IpoRow): NormalizedCatalyst | null {
  const date = row.date?.trim();
  if (!date) return null;

  const symbol = row.symbol?.trim().toUpperCase() || null;
  const name = row.name?.trim() || symbol || "IPO";
  const status = row.status?.trim().toLowerCase() ?? "";

  let subcategory = "ipo";
  if (/priced|completed|expected to price|priced at/i.test(status)) {
    subcategory = "ipo_priced";
  } else if (/filed|expected|upcoming|scheduled|announced/i.test(status)) {
    subcategory = "ipo_filed";
  } else if (/withdraw|cancel|postpon|terminated/i.test(status)) {
    subcategory = "ipo_withdrawn";
  }

  const key = `${symbol ?? name}:${date}:${subcategory}`.toLowerCase();

  return {
    provider: "finnhub",
    externalId: `finnhub:ipo:${key}`,
    url: null,
    rawContent: row,
    symbol: symbol,
    companyName: name,
    type: "IPO Calendar",
    title: `${name}${symbol ? ` (${symbol})` : ""} — IPO ${date}`,
    headline: row.status?.trim() || "IPO calendar",
    eventCategory: "capital",
    subcategory,
    timestamp: new Date(`${date}T12:00:00.000Z`).toISOString(),
    summary:
      [
        row.exchange?.trim(),
        row.price != null && row.price !== "" ? `Price ${row.price}` : null,
        row.numberOfShares != null ? `Shares ${row.numberOfShares}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    confidence: 60,
    tags: ["ipo", "capital"],
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
 * Finnhub earnings + FDA + classified news + recent PT + IPO calendar
 * + company profile enrichment.
 *
 * Quality-first: recommendation consensus snapshots are not ingested.
 * Generic company news stays dropped; only gold-classified headlines ship.
 * Soft-fails when FINNHUB_API_KEY is unset.
 */
export async function fetchFinnhubCatalysts(options?: {
  newsSymbols?: string[];
  analystSymbols?: string[];
  now?: Date;
}): Promise<SourceFetchResult> {
  const apiKey = getFinnhubApiKey();
  if (!apiKey) {
    return skippedSourceResult(
      "finnhub",
      "Finnhub is not configured. Add credentials to enable earnings/FDA/news/IPO ingest + profile enrichment.",
    );
  }

  const now = options?.now ?? new Date();
  const from = todayIsoDate(now);
  const to = daysFromIso(7, now);
  const normalized: NormalizedCatalyst[] = [];

  const earningsPayload = await finnhubGet<{
    earningsCalendar?: EarningsRow[];
  }>("/calendar/earnings", apiKey, { from, to });
  const earnings = earningsPayload.earningsCalendar ?? [];
  const earningsSlice = earnings.slice(0, 40);

  // Resolve display names before titling: companies table, then Finnhub profile2.
  const earningsSymbols = uniqueSymbols(earningsSlice, [], 40);
  const nameBySymbol = new Map<string, string>();
  for (const symbol of earningsSymbols) {
    const stored = await getCompanyName(symbol);
    if (stored) nameBySymbol.set(symbol, stored);
  }
  // Cap live profile lookups so earnings titling does not burn the free-tier quota.
  const needsProfile = earningsSymbols
    .filter((symbol) => !nameBySymbol.has(symbol))
    .slice(0, 12);
  for (const symbol of needsProfile) {
    try {
      const profile = await finnhubGet<ProfileRow>("/stock/profile2", apiKey, {
        symbol,
      });
      if (profile?.name?.trim()) {
        nameBySymbol.set(symbol, profile.name.trim());
      }
      if (profile?.ticker || symbol) {
        await upsertCompanyProfile({
          symbol: profile?.ticker || symbol,
          name: profile?.name,
          industry: profile?.finnhubIndustry,
          marketCapMillions: profile?.marketCapitalization,
        });
      }
    } catch (error) {
      console.warn(
        `Finnhub profile2 for ${symbol} unavailable:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  for (const row of earningsSlice) {
    const symbol = row.symbol?.trim().toUpperCase();
    const item = earningsToNormalized(
      row,
      symbol ? (nameBySymbol.get(symbol) ?? null) : null,
    );
    if (item) normalized.push(item);
  }

  try {
    const fdaPayload = await finnhubGet<FdaRow[] | { data?: FdaRow[] }>(
      "/fda-calendar",
      apiKey,
    );
    const fdaRows = Array.isArray(fdaPayload)
      ? fdaPayload
      : (fdaPayload.data ?? []);
    for (const row of fdaRows.slice(0, 25)) {
      const item = fdaToNormalized(row);
      if (item) normalized.push(item);
    }
  } catch (error) {
    console.warn(
      "Finnhub FDA calendar unavailable:",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    const ipoFrom = daysAgoIso(RETENTION_DAYS, now);
    const ipoTo = daysFromIso(14, now);
    const ipoPayload = await finnhubGet<{ ipoCalendar?: IpoRow[] }>(
      "/calendar/ipo",
      apiKey,
      { from: ipoFrom, to: ipoTo },
    );
    for (const row of ipoPayload.ipoCalendar ?? []) {
      const item = ipoToNormalized(row);
      if (item) normalized.push(item);
    }
  } catch (error) {
    console.warn(
      "Finnhub IPO calendar unavailable:",
      error instanceof Error ? error.message : error,
    );
  }

  const symbolSet =
    options?.analystSymbols?.slice(0, 8) ??
    options?.newsSymbols?.slice(0, 8) ??
    uniqueSymbols(earnings, DEFAULT_ANALYST_SYMBOLS, 8);

  const newsFrom = daysAgoIso(RETENTION_DAYS, now);
  const newsTo = todayIsoDate(now);
  let newsCount = 0;
  for (const symbol of symbolSet) {
    if (newsCount >= 40) break;
    try {
      const articles = await finnhubGet<CompanyNewsRow[]>(
        "/company-news",
        apiKey,
        { symbol, from: newsFrom, to: newsTo },
      );
      for (const row of articles) {
        if (newsCount >= 40) break;
        const item = companyNewsToNormalized(row, symbol);
        if (item) {
          normalized.push(item);
          newsCount++;
        }
      }
    } catch (error) {
      console.warn(
        `Finnhub company-news for ${symbol} unavailable:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  for (const symbol of symbolSet) {
    try {
      const pt = await finnhubGet<PriceTargetRow>(
        "/stock/price-target",
        apiKey,
        { symbol },
      );
      const item = priceTargetToNormalized(symbol, pt, { now });
      if (item) normalized.push(item);
    } catch (error) {
      console.warn(
        `Finnhub price-target for ${symbol} unavailable:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Enrich remaining analyst/news symbols not already profiled for earnings.
  for (const symbol of symbolSet) {
    if (nameBySymbol.has(symbol)) continue;
    try {
      const profile = await finnhubGet<ProfileRow>("/stock/profile2", apiKey, {
        symbol,
      });
      if (profile?.ticker) {
        await upsertCompanyProfile({
          symbol: profile.ticker,
          name: profile.name,
          industry: profile.finnhubIndustry,
          marketCapMillions: profile.marketCapitalization,
        });
      }
    } catch (error) {
      console.warn(
        `Finnhub profile2 for ${symbol} unavailable:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  const result = await ingestNormalizedCatalysts(normalized, { purge: false });
  return toSourceResult("finnhub", result);
}
