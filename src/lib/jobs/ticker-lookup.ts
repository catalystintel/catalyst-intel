import fs from "node:fs";
import path from "node:path";

import { type SecFetchMode, fetchSecUrl } from "./sec-edgar-http";

/** Official company_tickers.json on www.sec.gov (same Akamai edge as the Atom feed). */
const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const CACHE_PATH = path.join(
  process.cwd(),
  ".cache",
  "sec-company-tickers.json",
);
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

let inMemoryCache: Map<number, string> | null = null;
let inMemoryRecords: TickerEntry[] | null = null;

function readDiskCache(): Record<string, TickerEntry> | null {
  try {
    const stat = fs.statSync(CACHE_PATH);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null;
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8"));
  } catch {
    return null;
  }
}

function writeDiskCache(data: unknown) {
  try {
    fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(data));
  } catch {
    // Non-fatal - worst case we re-fetch next run.
  }
}

/**
 * SEC EDGAR filings only expose a CIK, not a ticker. This maps CIK -> ticker
 * using SEC's own free, keyless company_tickers.json, cached on disk for a
 * day so we don't re-download it on every admin-triggered fetch.
 */
export async function getTickerByCik(
  userAgent: string,
  options: { mode?: SecFetchMode } = {},
): Promise<Map<number, string>> {
  if (inMemoryCache) return inMemoryCache;

  const data = await loadTickerData(userAgent, options);
  inMemoryCache = buildMap(data);
  return inMemoryCache;
}

/**
 * Same dataset as {@link getTickerByCik}, indexed by company name instead of
 * CIK. Used to resolve a ticker from a sponsor/issuer name string (e.g.
 * openFDA `sponsor_name`, ClinicalTrials.gov lead sponsor) — see
 * `ticker-resolver.ts`. Shares the same 24h disk cache.
 */
export async function getTickerRecords(
  userAgent: string,
  options: { mode?: SecFetchMode } = {},
): Promise<TickerEntry[]> {
  if (inMemoryRecords) return inMemoryRecords;

  const data = await loadTickerData(userAgent, options);
  inMemoryRecords = Object.values(data).filter(
    (entry) => entry?.cik_str != null && Boolean(entry?.ticker),
  );
  return inMemoryRecords;
}

async function loadTickerData(
  userAgent: string,
  options: { mode?: SecFetchMode } = {},
): Promise<Record<string, TickerEntry>> {
  const cached = readDiskCache();
  if (cached) return cached;

  const res = await fetchSecUrl(TICKERS_URL, {
    userAgent,
    mode: options.mode ?? "primary",
  });
  const data = (await res.json()) as Record<string, TickerEntry>;
  writeDiskCache(data);
  return data;
}

export function buildMap(
  data: Record<string, TickerEntry>,
): Map<number, string> {
  const map = new Map<number, string>();
  for (const entry of Object.values(data)) {
    if (entry?.cik_str != null && entry?.ticker) {
      map.set(entry.cik_str, entry.ticker);
    }
  }
  return map;
}

/** Test helper — clear in-memory ticker caches between cases. */
export function clearTickerLookupCache(): void {
  inMemoryCache = null;
  inMemoryRecords = null;
}
