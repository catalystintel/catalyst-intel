/**
 * Persists vendor company profile fields (sector, market cap, exchange, logo)
 * that were previously fetched during Finnhub ingest and then discarded.
 * Without this, `companies.sector` / `marketCap` stay null forever and the
 * Live feed's "Sector" column silently falls back to event category.
 */

import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { companies } from "@/db/schema";
import { normalizeToGicsLabel } from "@/lib/companies/gics-sectors";

export interface CompanyProfileInput {
  ticker: string;
  name?: string | null;
  industry?: string | null;
  /** Millions of USD, as returned by Finnhub `marketCapitalization`. */
  marketCapMillions?: number | null;
  exchange?: string | null;
  logoUrl?: string | null;
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

/**
 * Upserts a company row and refreshes profile fields when the vendor
 * provided something new. Never overwrites an existing field with null —
 * enrichment only adds signal, it never erases prior data.
 */
export async function upsertCompanyProfile(
  input: CompanyProfileInput,
): Promise<void> {
  const ticker = normalizeTicker(input.ticker);
  if (!ticker) return;

  const marketCap =
    typeof input.marketCapMillions === "number" &&
    Number.isFinite(input.marketCapMillions)
      ? Math.round(input.marketCapMillions)
      : null;

  const existing = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.ticker, ticker))
    .get();

  const now = new Date().toISOString();
  const sector = normalizeToGicsLabel(input.industry);

  if (!existing) {
    await db
      .insert(companies)
      .values({
        name: input.name?.trim() || ticker,
        ticker,
        sector,
        marketCap,
        exchange: input.exchange?.trim() || null,
        logoUrl: input.logoUrl?.trim() || null,
        enrichedAt: now,
      })
      .run();
    return;
  }

  const updates: Partial<typeof companies.$inferInsert> = { enrichedAt: now };
  if (input.name?.trim()) updates.name = input.name.trim();
  if (sector) updates.sector = sector;
  if (marketCap != null) updates.marketCap = marketCap;
  if (input.exchange?.trim()) updates.exchange = input.exchange.trim();
  if (input.logoUrl?.trim()) updates.logoUrl = input.logoUrl.trim();

  await db
    .update(companies)
    .set(updates)
    .where(eq(companies.id, existing.id))
    .run();
}

/** Looks up the current market cap (millions USD) for a ticker, if known. */
export async function getCompanyMarketCapMillions(
  ticker: string | null | undefined,
): Promise<number | null> {
  const t = ticker?.trim().toUpperCase();
  if (!t) return null;
  const row = await db
    .select({ marketCap: companies.marketCap })
    .from(companies)
    .where(eq(companies.ticker, t))
    .get();
  return row?.marketCap ?? null;
}

/**
 * Looks up a stored company display name for a ticker.
 * Returns null when missing or when the stored name is just the ticker itself
 * (so callers can try a richer vendor profile next).
 */
export async function getCompanyName(
  ticker: string | null | undefined,
): Promise<string | null> {
  const t = ticker?.trim().toUpperCase();
  if (!t) return null;
  const row = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.ticker, t))
    .get();
  const name = row?.name?.trim() || null;
  if (!name) return null;
  if (name.toUpperCase() === t) return null;
  return name;
}
