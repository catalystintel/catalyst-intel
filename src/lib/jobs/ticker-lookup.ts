import fs from "node:fs";
import path from "node:path";

const TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const CACHE_PATH = path.join(process.cwd(), ".cache", "sec-company-tickers.json");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

let inMemoryCache: Map<number, string> | null = null;

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
export async function getTickerByCik(userAgent: string): Promise<Map<number, string>> {
  if (inMemoryCache) return inMemoryCache;

  const cached = readDiskCache();
  if (cached) {
    inMemoryCache = buildMap(cached);
    return inMemoryCache;
  }

  const res = await fetch(TICKERS_URL, { headers: { "User-Agent": userAgent } });
  if (!res.ok) {
    throw new Error(`Failed to fetch SEC company tickers: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as Record<string, TickerEntry>;
  writeDiskCache(data);
  inMemoryCache = buildMap(data);
  return inMemoryCache;
}

export function buildMap(data: Record<string, TickerEntry>): Map<number, string> {
  const map = new Map<number, string>();
  for (const entry of Object.values(data)) {
    if (entry?.cik_str != null && entry?.ticker) {
      map.set(entry.cik_str, entry.ticker);
    }
  }
  return map;
}
