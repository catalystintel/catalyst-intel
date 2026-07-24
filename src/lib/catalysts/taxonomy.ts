/**
 * Shared event taxonomy for multi-source catalyst ingest.
 * SEC 8-K items, trading halts, FDA/clinical, insider filings, and news
 * all map into these keys for Live feed filtering and materiality.
 */

export type EventCategoryKey =
  | "earnings"
  | "deals"
  | "management"
  | "capital"
  | "distress"
  | "restructuring"
  | "governance"
  | "disclosure"
  | "trading_halt"
  | "insider"
  | "regulatory"
  | "clinical"
  | "macro"
  | "analyst"
  | "cyber"
  | "news"
  | "other";

/** Display names for each category (single source of truth for UI + storage). */
export const CATEGORY_LABELS: Record<EventCategoryKey, string> = {
  earnings: "Earnings",
  deals: "M&A / Deals",
  management: "Management",
  capital: "Capital / Financing",
  distress: "Distress",
  restructuring: "Restructuring",
  governance: "Governance",
  disclosure: "Disclosure",
  trading_halt: "Trading Halt",
  insider: "Insider",
  regulatory: "Regulatory / FDA",
  clinical: "Clinical",
  macro: "Economics / Macro",
  analyst: "Analyst Actions",
  cyber: "Cybersecurity",
  news: "News",
  other: "Other",
};

/**
 * Higher wins when ranking items / rule-based materiality (0–100)
 * until AI scoring ships.
 */
export const CATEGORY_PRIORITY: Record<EventCategoryKey, number> = {
  distress: 90,
  trading_halt: 88,
  cyber: 87,
  earnings: 85,
  regulatory: 82,
  deals: 80,
  macro: 78,
  clinical: 75,
  analyst: 72,
  restructuring: 70,
  capital: 60,
  insider: 58,
  management: 55,
  governance: 40,
  news: 30,
  disclosure: 20,
  other: 10,
};

export const VALID_EVENT_CATEGORIES = new Set<string>(
  Object.keys(CATEGORY_LABELS),
);

export function isEventCategoryKey(value: string): value is EventCategoryKey {
  return VALID_EVENT_CATEGORIES.has(value);
}
