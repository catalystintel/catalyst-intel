import { eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { nyseListings } from "@/db/schema";
import { getFinnhubApiKey } from "@/lib/jobs/finnhub-env";

const SYMBOLS_URL = "https://finnhub.io/api/v1/stock/symbol?exchange=US";
const QUOTE_URL = "https://finnhub.io/api/v1/quote";

/** NYSE primary MIC on Finnhub US symbol feed. */
export const NYSE_MIC = "XNYS";

export interface FinnhubSymbolRow {
  currency?: string;
  description?: string;
  displaySymbol?: string;
  figi?: string;
  mic?: string;
  symbol?: string;
  type?: string;
}

export interface FetchFinnhubNyseResult {
  configured: boolean;
  fetched: number;
  nyseFiltered: number;
  upserted: number;
  quoted: number;
  quoteErrors: number;
  ranAt: string;
  message?: string;
}

function isNyseListing(row: FinnhubSymbolRow): boolean {
  const mic = row.mic?.trim().toUpperCase();
  if (mic === NYSE_MIC) return true;
  // Fallback: some rows omit mic but include NYSE in type/description noise — skip those.
  return false;
}

/**
 * Pulls Finnhub US symbols, keeps NYSE (XNYS), upserts into `nyse_listings`.
 * Optionally quotes up to `quoteLimit` symbols (watchlist-style enrichment).
 * Soft-fails with configured:false when FINNHUB_API_KEY is unset.
 */
export async function fetchFinnhubNyse(options?: {
  quoteLimit?: number;
  quoteSymbols?: string[];
}): Promise<FetchFinnhubNyseResult> {
  const ranAt = new Date().toISOString();
  const apiKey = getFinnhubApiKey();
  if (!apiKey) {
    return {
      configured: false,
      fetched: 0,
      nyseFiltered: 0,
      upserted: 0,
      quoted: 0,
      quoteErrors: 0,
      ranAt,
      message:
        "Finnhub is not configured. Add credentials in Vercel / .env.local to enable NYSE listings.",
    };
  }

  const res = await fetch(
    `${SYMBOLS_URL}&token=${encodeURIComponent(apiKey)}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Finnhub symbols failed (${res.status}): ${body.slice(0, 200) || res.statusText}`,
    );
  }

  const payload = (await res.json()) as FinnhubSymbolRow[];
  if (!Array.isArray(payload)) {
    throw new Error("Finnhub symbols response was not an array.");
  }

  const nyseRows = payload.filter(isNyseListing);
  let upserted = 0;

  for (const row of nyseRows) {
    const symbol = row.symbol?.trim().toUpperCase();
    if (!symbol) continue;
    const displaySymbol = (row.displaySymbol?.trim() || symbol).toUpperCase();

    const existing = await db
      .select({ id: nyseListings.id })
      .from(nyseListings)
      .where(eq(nyseListings.symbol, symbol))
      .get();

    if (existing) {
      await db
        .update(nyseListings)
        .set({
          displaySymbol,
          description: row.description?.trim() || null,
          mic: row.mic?.trim() || NYSE_MIC,
          type: row.type?.trim() || null,
          currency: row.currency?.trim() || null,
          updatedAt: sql`(current_timestamp)`,
        })
        .where(eq(nyseListings.id, existing.id))
        .run();
    } else {
      await db
        .insert(nyseListings)
        .values({
          symbol,
          displaySymbol,
          description: row.description?.trim() || null,
          mic: row.mic?.trim() || NYSE_MIC,
          type: row.type?.trim() || null,
          currency: row.currency?.trim() || null,
        })
        .run();
    }
    upserted += 1;
  }

  const quoteLimit = Math.min(Math.max(options?.quoteLimit ?? 0, 0), 40);
  let quoted = 0;
  let quoteErrors = 0;

  const toQuote = new Set<string>();
  for (const s of options?.quoteSymbols ?? []) {
    const t = s.trim().toUpperCase();
    if (t) toQuote.add(t);
  }
  if (quoteLimit > 0 && toQuote.size < quoteLimit) {
    const sample = await db
      .select({ symbol: nyseListings.symbol })
      .from(nyseListings)
      .limit(quoteLimit)
      .all();
    for (const row of sample) {
      if (toQuote.size >= quoteLimit) break;
      toQuote.add(row.symbol);
    }
  }

  for (const symbol of toQuote) {
    try {
      const price = await fetchQuotePrice(apiKey, symbol);
      if (price == null) {
        quoteErrors += 1;
        continue;
      }
      await db
        .update(nyseListings)
        .set({
          lastPrice: price,
          quotedAt: new Date().toISOString(),
          updatedAt: sql`(current_timestamp)`,
        })
        .where(eq(nyseListings.symbol, symbol))
        .run();
      quoted += 1;
    } catch {
      quoteErrors += 1;
    }
  }

  return {
    configured: true,
    fetched: payload.length,
    nyseFiltered: nyseRows.length,
    upserted,
    quoted,
    quoteErrors,
    ranAt,
  };
}

async function fetchQuotePrice(
  apiKey: string,
  symbol: string,
): Promise<string | null> {
  const url = `${QUOTE_URL}?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { c?: number };
  if (typeof data.c !== "number" || !Number.isFinite(data.c) || data.c <= 0) {
    return null;
  }
  return data.c.toFixed(2);
}
