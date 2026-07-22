/**
 * Optional server-side Finnhub earnings enrichment for the article view.
 * Soft-fails when FINNHUB_API_KEY is unset or the request errors.
 * Light in-memory TTL cache to avoid hammering Finnhub on refreshes.
 */

import {
  finnhubStockEarningsToFigures,
  type EarningsFigures,
} from "@/lib/catalysts/article-detail";
import { getFinnhubApiKey } from "@/lib/jobs/vendor-env";

const BASE = "https://finnhub.io/api/v1";
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;

interface CacheEntry {
  expiresAt: number;
  value: EarningsFigures | null;
}

const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): EarningsFigures | null | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key: string, value: EarningsFigures | null): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest != null) cache.delete(oldest);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

interface FinnhubEarningsRow {
  actual?: number | null;
  estimate?: number | null;
  period?: string | null;
  quarter?: number | null;
  surprise?: number | null;
  surprisePercent?: number | null;
  symbol?: string | null;
  year?: number | null;
}

/**
 * Fetch the latest reported earnings for a ticker from Finnhub.
 * Returns null when unconfigured, empty, or on any network/API failure.
 */
export async function fetchLatestEarningsForTicker(
  ticker: string,
): Promise<EarningsFigures | null> {
  const symbol = ticker.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.]{0,11}$/.test(symbol)) return null;

  const cached = cacheGet(symbol);
  if (cached !== undefined) return cached;

  const apiKey = getFinnhubApiKey();
  if (!apiKey) {
    cacheSet(symbol, null);
    return null;
  }

  try {
    const url = new URL(`${BASE}/stock/earnings`);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("token", apiKey);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      cacheSet(symbol, null);
      return null;
    }

    const payload = (await res.json()) as FinnhubEarningsRow[] | null;
    if (!Array.isArray(payload) || payload.length === 0) {
      cacheSet(symbol, null);
      return null;
    }

    // Finnhub returns newest-first; pick the first row with any EPS figure.
    const row =
      payload.find(
        (r) =>
          (typeof r.actual === "number" && Number.isFinite(r.actual)) ||
          (typeof r.estimate === "number" && Number.isFinite(r.estimate)),
      ) ?? payload[0];

    const figures = finnhubStockEarningsToFigures(row);
    cacheSet(symbol, figures);
    return figures;
  } catch {
    cacheSet(symbol, null);
    return null;
  }
}

/**
 * True when stored raw lacks EPS actual/estimate — safe to fetch Finnhub
 * latest without mixing another quarter onto an estimate-only calendar row.
 */
export function needsEarningsEnrichment(rawContent: unknown): boolean {
  if (!rawContent || typeof rawContent !== "object") return true;
  const raw = rawContent as Record<string, unknown>;
  const nested =
    Array.isArray(raw.earningsCalendar) && raw.earningsCalendar[0]
      ? (raw.earningsCalendar[0] as Record<string, unknown>)
      : raw;
  return !(
    nested.epsActual != null ||
    nested.epsEstimate != null ||
    nested.actual != null ||
    nested.estimate != null
  );
}

/** Test helper — clear enrichment cache between cases. */
export function clearEarningsEnrichmentCache(): void {
  cache.clear();
}
