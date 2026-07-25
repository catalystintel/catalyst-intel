/**
 * SEC EDGAR filings only expose a CIK, not a symbol. Maps CIK → symbol using
 * SEC's free company_tickers.json (vendor filename/field names kept as-is),
 * cached on disk for a day so we don't re-download on every fetch.
 */

import fs from "node:fs";
import path from "node:path";

import { type SecFetchMode, fetchSecUrl } from "./sec-edgar-http";

/** Official SEC file — vendor path; do not rename. */
const SEC_COMPANY_TICKERS_URL =
  "https://www.sec.gov/files/company_tickers.json";
const CACHE_PATH = path.join(
  process.cwd(),
  ".cache",
  "sec-company-tickers.json",
);
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Wire shape from SEC company_tickers.json (`ticker` is their field name). */
interface SecCompanyTickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

/** Our domain shape — always use `symbol`. */
export interface SymbolEntry {
  cik_str: number;
  symbol: string;
  title: string;
}

let inMemoryCache: Map<number, string> | null = null;
let inMemoryRecords: SymbolEntry[] | null = null;

function toSymbolEntry(entry: SecCompanyTickerEntry): SymbolEntry {
  return {
    cik_str: entry.cik_str,
    symbol: entry.ticker,
    title: entry.title,
  };
}

function readDiskCache(): Record<string, SecCompanyTickerEntry> | null {
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

export async function getSymbolByCik(
  userAgent: string,
  options: { mode?: SecFetchMode } = {},
): Promise<Map<number, string>> {
  if (inMemoryCache) return inMemoryCache;

  const data = await loadSecTickerData(userAgent, options);
  inMemoryCache = buildMap(data);
  return inMemoryCache;
}

/**
 * Same dataset as {@link getSymbolByCik}, as records for name → symbol
 * resolution (openFDA / ClinicalTrials) — see `symbol-resolver.ts`.
 */
export async function getSymbolRecords(
  userAgent: string,
  options: { mode?: SecFetchMode } = {},
): Promise<SymbolEntry[]> {
  if (inMemoryRecords) return inMemoryRecords;

  const data = await loadSecTickerData(userAgent, options);
  inMemoryRecords = Object.values(data)
    .filter((entry) => entry?.cik_str != null && Boolean(entry?.ticker))
    .map(toSymbolEntry);
  return inMemoryRecords;
}

async function loadSecTickerData(
  userAgent: string,
  options: { mode?: SecFetchMode } = {},
): Promise<Record<string, SecCompanyTickerEntry>> {
  const cached = readDiskCache();
  if (cached) return cached;

  const res = await fetchSecUrl(SEC_COMPANY_TICKERS_URL, {
    userAgent,
    mode: options.mode ?? "primary",
  });
  const data = (await res.json()) as Record<string, SecCompanyTickerEntry>;
  writeDiskCache(data);
  return data;
}

export function buildMap(
  data: Record<string, SecCompanyTickerEntry>,
): Map<number, string> {
  const map = new Map<number, string>();
  for (const entry of Object.values(data)) {
    if (entry?.cik_str != null && entry?.ticker) {
      map.set(entry.cik_str, entry.ticker);
    }
  }
  return map;
}

/** Test helper — clear in-memory symbol caches between cases. */
export function clearSymbolLookupCache(): void {
  inMemoryCache = null;
  inMemoryRecords = null;
}
