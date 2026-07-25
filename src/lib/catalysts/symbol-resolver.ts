/**
 * Resolves a sponsor / issuer name string (openFDA `sponsor_name`,
 * ClinicalTrials.gov lead sponsor, etc.) into a tradable symbol.
 *
 * Without this, FDA and clinical-trial rows are permanently `symbol: null` —
 * unusable for watchlist matching, quiet mode, or alerts. See
 * docs/research/Catalyst-Intel-Sources-and-Schema-Recommendation.md.
 *
 * Resolution order (cheapest/most-trusted first):
 * 1. Exact match against SEC's free company_tickers.json name index.
 * 2. Fuzzy containment match against the same index.
 * 3. Optional Finnhub `/search` symbol lookup (only if FINNHUB_API_KEY set).
 *
 * Every result records `source` + a 0-100 `confidence` so the UI/alerts can
 * be honest about how sure we are — never silently guess.
 */

import { getSymbolRecords } from "@/lib/jobs/symbol-lookup";
import { getFinnhubApiKey } from "@/lib/jobs/vendor-env";
import type { SymbolSource } from "@/db/schema";

export interface ResolvedSymbol {
  symbol: string;
  source: Exclude<SymbolSource, "vendor" | "sec-cik-map" | "unresolved">;
  confidence: number;
}

const LEGAL_SUFFIX_RE =
  /\b(INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|LLC|LLP|LP|PLC|HOLDINGS?|GROUP|SA|NV|AG|SE)\b\.?/g;

/** Normalizes a company name for comparison: upper-case, strip legal suffixes/punctuation. */
export function normalizeCompanyName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,]/g, " ")
    .replace(LEGAL_SUFFIX_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MIN_FUZZY_LENGTH = 6;

async function resolveViaFinnhub(name: string): Promise<ResolvedSymbol | null> {
  const apiKey = getFinnhubApiKey();
  if (!apiKey) return null;

  try {
    const url = new URL("https://finnhub.io/api/v1/search");
    url.searchParams.set("q", name);
    url.searchParams.set("token", apiKey);
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;

    const payload = (await res.json()) as {
      result?: Array<{ symbol?: string; type?: string; description?: string }>;
    };
    const match = (payload.result ?? []).find(
      (r) =>
        r.type === "Common Stock" &&
        r.symbol &&
        !r.symbol.includes(".") &&
        !r.symbol.includes(":"),
    );
    if (!match?.symbol) return null;

    return {
      symbol: match.symbol.trim().toUpperCase(),
      source: "finnhub-search",
      confidence: 65,
    };
  } catch {
    return null;
  }
}

/**
 * Attempts to resolve `sponsorOrBrandName` to a symbol. Soft-fails to `null`
 * on any error or when nothing sufficiently confident is found — callers
 * should leave `symbol: null` rather than guess.
 */
export async function resolveSymbolFromName(
  sponsorOrBrandName: string | null | undefined,
  options: { userAgent: string; allowFinnhubFallback?: boolean },
): Promise<ResolvedSymbol | null> {
  const raw = sponsorOrBrandName?.trim();
  if (!raw) return null;

  const target = normalizeCompanyName(raw);
  if (!target) return null;

  try {
    const records = await getSymbolRecords(options.userAgent);

    let bestFuzzy: { symbol: string; score: number } | null = null;
    for (const record of records) {
      const candidate = normalizeCompanyName(record.title);
      if (!candidate) continue;

      if (candidate === target) {
        return {
          symbol: record.symbol,
          source: "sec-name-exact",
          confidence: 90,
        };
      }

      if (
        target.length >= MIN_FUZZY_LENGTH &&
        candidate.length >= MIN_FUZZY_LENGTH
      ) {
        const contains =
          candidate.startsWith(target) || target.startsWith(candidate);
        if (contains) {
          // Prefer the longer overlap (closer to a full match).
          const score = Math.min(candidate.length, target.length);
          if (!bestFuzzy || score > bestFuzzy.score) {
            bestFuzzy = { symbol: record.symbol, score };
          }
        }
      }
    }

    if (bestFuzzy) {
      return {
        symbol: bestFuzzy.symbol,
        source: "sec-name-fuzzy",
        confidence: 60,
      };
    }
  } catch {
    // SEC lookup unavailable (e.g. missing UA in a test context) — fall through.
  }

  if (options.allowFinnhubFallback !== false) {
    const finnhub = await resolveViaFinnhub(raw);
    if (finnhub) return finnhub;
  }

  return null;
}
