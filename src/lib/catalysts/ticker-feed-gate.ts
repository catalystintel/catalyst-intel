/**
 * Desk tape rule: prefer rows tied to a tradable symbol.
 * CPI and Jobs/NFP macro calendar (and matching headlines) stay visible
 * even when ticker is null — see `fetch-macro-calendar`.
 */

import { or, sql, type SQL } from "drizzle-orm";

import { catalysts } from "@/db/schema";

/** Macro-calendar subcategories allowed without a ticker. */
export const TICKERLESS_MACRO_SUBCATEGORIES = ["cpi", "nfp"] as const;

export type TickerlessMacroSubcategory =
  (typeof TICKERLESS_MACRO_SUBCATEGORIES)[number];

export interface TickerFeedGateInput {
  ticker?: string | null;
  eventCategory?: string | null;
  subcategory?: string | null;
  title?: string | null;
  headline?: string | null;
  tags?: string[] | null;
}

/**
 * True for CPI index / Jobs report (NFP) rows that may appear without a
 * ticker. Matches macro-calendar storage (`subcategory` + tags) and common
 * title/headline phrasing; FOMC is intentionally excluded.
 */
export function isTickerlessMacroException(item: TickerFeedGateInput): boolean {
  const sub = (item.subcategory ?? "").trim().toLowerCase();
  if (sub === "cpi" || sub === "nfp") return true;

  const tags = (item.tags ?? []).map((t) => t.trim().toLowerCase());
  if (tags.includes("cpi") || tags.includes("nfp")) return true;

  const text = `${item.title ?? ""} ${item.headline ?? ""}`.toLowerCase();
  if (/\bcpi\b/.test(text)) return true;
  if (/\b(nfp|non[\s-]?farm|jobs report|employment situation)\b/.test(text)) {
    return true;
  }

  return false;
}

/** True when the row has a symbol, or is an allowed tickerless macro. */
export function passesTickerFeedGate(item: TickerFeedGateInput): boolean {
  if ((item.ticker ?? "").trim()) return true;
  return isTickerlessMacroException(item);
}

/**
 * SQL predicate for “has ticker OR CPI/Jobs exception”.
 * Used by `buildFeedWhere` when Symbol-only / tickerOnly is on.
 *
 * Primary match = macro-calendar fields (`subcategory` / tags). Title/headline
 * LIKE patterns cover the same CPI / NFP wording used at ingest.
 */
export function tickerFeedGateSql(): SQL {
  const haystack = sql`lower(coalesce(${catalysts.title}, '') || ' ' || coalesce(${catalysts.headline}, ''))`;

  return or(
    sql`(
      ${catalysts.ticker} IS NOT NULL
      AND trim(${catalysts.ticker}) != ''
    )`,
    sql`lower(coalesce(${catalysts.subcategory}, '')) IN ('cpi', 'nfp')`,
    sql`lower(coalesce(${catalysts.tags}, '')) LIKE '%"cpi"%'`,
    sql`lower(coalesce(${catalysts.tags}, '')) LIKE '%"nfp"%'`,
    sql`${haystack} LIKE '%cpi%'`,
    sql`${haystack} LIKE '%nfp%'`,
    sql`${haystack} LIKE '%nonfarm%'`,
    sql`${haystack} LIKE '%non-farm%'`,
    sql`${haystack} LIKE '%jobs report%'`,
    sql`${haystack} LIKE '%employment situation%'`,
  )!;
}
