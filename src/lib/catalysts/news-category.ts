/**
 * Map free-text headlines into Benzinga-like calendar / newsfeed panels.
 * Used by Finnhub + Polygon news ingest — heuristic only, not Wire exclusives.
 */

import type { EventCategoryKey } from "@/lib/catalysts/taxonomy";

export interface NewsCategoryHit {
  eventCategory: EventCategoryKey;
  subcategory: string;
  tags: string[];
}

const RULES: Array<{
  test: RegExp;
  eventCategory: EventCategoryKey;
  subcategory: string;
  tags: string[];
}> = [
  {
    test: /\b(pdufa|fda|adcom|advisory committee|bla\b|nda\b|crl\b|approval)\b/i,
    eventCategory: "regulatory",
    subcategory: "fda_news",
    tags: ["fda", "regulatory"],
  },
  {
    test: /\b(earnings|eps|guidance|beats estimates|misses estimates|quarterly results)\b/i,
    eventCategory: "earnings",
    subcategory: "earnings_news",
    tags: ["earnings"],
  },
  {
    test: /\b(merger|acquisition|acquire[sd]?|takeover|buyout|deal to buy)\b/i,
    eventCategory: "deals",
    subcategory: "ma_news",
    tags: ["m&a", "deals"],
  },
  {
    test: /\b(offering|secondary|dilution|atm offering|priced offering|shelf registration)\b/i,
    eventCategory: "capital",
    subcategory: "offering_news",
    tags: ["offering", "capital"],
  },
  {
    test: /\b(ipo|initial public offering|prices ipo|files? for ipo|withdraws? ipo)\b/i,
    eventCategory: "capital",
    subcategory: "ipo_news",
    tags: ["ipo", "capital"],
  },
  {
    test: /\bupgrade[sd]?\b/i,
    eventCategory: "analyst",
    subcategory: "upgrade",
    tags: ["analyst", "upgrade"],
  },
  {
    test: /\bdowngrade[sd]?\b/i,
    eventCategory: "analyst",
    subcategory: "downgrade",
    tags: ["analyst", "downgrade"],
  },
  {
    test: /\b(price target|raises pt|cuts pt|pt to \$|target price|initiates coverage)\b/i,
    eventCategory: "analyst",
    subcategory: "price_target",
    tags: ["analyst", "price_target"],
  },
  {
    test: /\b(analyst rating|reiterates|maintains)\b/i,
    eventCategory: "analyst",
    subcategory: "analyst_rating",
    tags: ["ratings", "analyst"],
  },
  {
    test: /\b(trading halt|halted|resume[sd]? trading|luld)\b/i,
    eventCategory: "trading_halt",
    subcategory: "halt_news",
    tags: ["halt"],
  },
  {
    test: /\b(cpi|nfp|nonfarm|fomc|fed rate|powell|pce|jobs report)\b/i,
    eventCategory: "macro",
    subcategory: "macro_news",
    tags: ["macro", "economics"],
  },
  {
    test: /\b(phase [123]|clinical trial|topline|endpoint|biotech)\b/i,
    eventCategory: "clinical",
    subcategory: "clinical_news",
    tags: ["clinical"],
  },
];

/**
 * Classify a headline (+ optional vendor category) into taxonomy + subcategory.
 */
export function categorizeNewsHeadline(
  headline: string,
  vendorCategory?: string | null,
): NewsCategoryHit {
  const text = `${headline} ${vendorCategory ?? ""}`.trim();
  for (const rule of RULES) {
    if (rule.test.test(text)) {
      return {
        eventCategory: rule.eventCategory,
        subcategory: rule.subcategory,
        tags: rule.tags,
      };
    }
  }

  const vendor = vendorCategory?.trim().toLowerCase();
  if (vendor === "earnings") {
    return {
      eventCategory: "earnings",
      subcategory: "earnings_news",
      tags: ["earnings"],
    };
  }
  if (vendor === "merger" || vendor === "m&a") {
    return {
      eventCategory: "deals",
      subcategory: "ma_news",
      tags: ["m&a"],
    };
  }

  return {
    eventCategory: "news",
    subcategory: vendor?.replace(/\s+/g, "_") || "company_news",
    tags: ["news"],
  };
}
