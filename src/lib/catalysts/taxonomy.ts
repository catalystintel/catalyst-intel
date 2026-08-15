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
  deals: "M&A",
  management: "Management",
  capital: "Capital Markets",
  distress: "Distress",
  restructuring: "Restructuring",
  governance: "Governance",
  disclosure: "Disclosure",
  trading_halt: "Trading Halt",
  insider: "Insider",
  regulatory: "FDA / Regulatory",
  clinical: "Clinical",
  macro: "Macro",
  analyst: "Analyst",
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

/**
 * High-signal catalyst subjects — always welcome on the desk tape.
 * Thin `news` / `disclosure` / `other` rows need extracted facts to stay.
 */
export const GOLD_SUBJECTS: readonly EventCategoryKey[] = [
  "distress",
  "trading_halt",
  "cyber",
  "earnings",
  "regulatory",
  "deals",
  "macro",
  "clinical",
  "restructuring",
  "capital",
] as const;

/**
 * Default Live-feed category chips: gold subjects plus common desk secondaries.
 * Excludes thin `news` / `disclosure` / `other` / routine `governance`.
 */
export const DEFAULT_FEED_SUBJECTS: readonly EventCategoryKey[] = [
  ...GOLD_SUBJECTS,
  "analyst",
  "insider",
  "management",
] as const;

export const GOLD_SUBJECT_SET = new Set<EventCategoryKey>(GOLD_SUBJECTS);

export function isEventCategoryKey(value: string): value is EventCategoryKey {
  return VALID_EVENT_CATEGORIES.has(value);
}

/**
 * Category labels that must not appear as chips/keys inside open-article chrome
 * (split / details / article view). Feed filters and taxonomy keep the key.
 */
const ARTICLE_SUPPRESSED_CATEGORY_LABELS = new Set<EventCategoryKey>([
  "capital",
]);

/** Display label for article interiors — null when the taxonomy key is suppressed. */
export function articleCategoryLabel(category?: string | null): string | null {
  if (!category || !isEventCategoryKey(category)) return null;
  if (ARTICLE_SUPPRESSED_CATEGORY_LABELS.has(category)) return null;
  return CATEGORY_LABELS[category];
}

/** Whether to render a category badge inside open-article chrome. */
export function showArticleCategoryBadge(
  category?: string | null,
): category is EventCategoryKey {
  return articleCategoryLabel(category) != null;
}

/** Order-insensitive equality for category chip lists. */
export function sameCategorySet(
  a: readonly string[],
  b: readonly string[],
): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((c) => set.has(c));
}
