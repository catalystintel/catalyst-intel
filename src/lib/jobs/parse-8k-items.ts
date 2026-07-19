/**
 * Turns the raw SEC 8-K feed summary into trader-meaningful signal.
 *
 * The EDGAR Atom feed already embeds the filing's Item codes and their official
 * descriptions in the summary text (e.g. "Item 5.02: Departure of Directors..."),
 * but the official wording is long and legalese. We map each code to a short
 * label and a category, and pick the single most market-moving item as the
 * headline - an 8-K's Item code is the whole reason a trader cares which one it is.
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
  | "other";

export interface ParsedItem {
  /** SEC item number, e.g. "5.02". */
  code: string;
  /** Short trader-facing label for this item. */
  label: string;
  category: EventCategoryKey;
}

export interface ParsedFiling {
  items: ParsedItem[];
  /** The most market-moving item's category, used for filtering/color. */
  primaryCategory: EventCategoryKey;
  /** Short headline for the most market-moving item (the feed's "Event" cell). */
  headline: string;
}

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
  other: "Other",
};

interface ItemMeta {
  label: string;
  category: EventCategoryKey;
}

const ITEM_CATALOG: Record<string, ItemMeta> = {
  "1.01": { label: "Material agreement", category: "deals" },
  "1.02": { label: "Agreement terminated", category: "deals" },
  "1.03": { label: "Bankruptcy / receivership", category: "distress" },
  "1.04": { label: "Mine safety", category: "other" },
  "2.01": { label: "Acquisition / disposition closed", category: "deals" },
  "2.02": { label: "Earnings / results", category: "earnings" },
  "2.03": { label: "New financial obligation", category: "capital" },
  "2.04": { label: "Debt acceleration", category: "distress" },
  "2.05": { label: "Restructuring / exit costs", category: "restructuring" },
  "2.06": { label: "Material impairment", category: "distress" },
  "3.01": { label: "Delisting risk", category: "distress" },
  "3.02": { label: "Unregistered equity sale", category: "capital" },
  "3.03": { label: "Security holder rights change", category: "capital" },
  "4.01": { label: "Auditor change", category: "governance" },
  "4.02": { label: "Financials non-reliance", category: "distress" },
  "5.01": { label: "Change of control", category: "deals" },
  "5.02": { label: "Officer / director change", category: "management" },
  "5.03": { label: "Charter / bylaw change", category: "governance" },
  "5.04": { label: "Trading blackout", category: "governance" },
  "5.05": { label: "Ethics code change", category: "governance" },
  "5.07": { label: "Shareholder vote", category: "governance" },
  "5.08": { label: "Director nominations", category: "governance" },
  "7.01": { label: "Reg FD disclosure", category: "disclosure" },
  "8.01": { label: "Other event", category: "disclosure" },
  "9.01": { label: "Exhibits", category: "other" },
};

// Higher wins when a filing lists several items. Distress/earnings/deals are the
// headline-grabbers; 9.01 (exhibits) and 7.01/8.01 are near-boilerplate padding.
const CATEGORY_PRIORITY: Record<EventCategoryKey, number> = {
  distress: 90,
  earnings: 85,
  deals: 80,
  restructuring: 70,
  capital: 60,
  management: 55,
  governance: 40,
  disclosure: 20,
  other: 10,
};

// "Exhibits" almost always tags along with the real item, so it should never win
// the headline unless it is genuinely the only thing in the filing.
const BOILERPLATE_CODES = new Set(["9.01"]);

const ITEM_PATTERN = /Item\s+(\d+\.\d+)/g;

function metaForCode(code: string): ItemMeta {
  return ITEM_CATALOG[code] ?? { label: `Item ${code}`, category: "other" };
}

/**
 * Extracts and de-duplicates the ordered list of 8-K items named in a feed summary.
 *
 * @param summary - Raw EDGAR Atom `summary` text; may be empty.
 * @returns Items in order of first appearance, empty if none are found.
 */
export function extractItems(summary: string): ParsedItem[] {
  const seen = new Set<string>();
  const items: ParsedItem[] = [];
  for (const match of summary.matchAll(ITEM_PATTERN)) {
    const code = match[1];
    if (seen.has(code)) {
      continue;
    }
    seen.add(code);
    const meta = metaForCode(code);
    items.push({ code, label: meta.label, category: meta.category });
  }
  return items;
}

/**
 * Picks the single most market-moving item to headline the feed row.
 *
 * @param items - Parsed items from {@link extractItems}.
 * @returns The chosen item, or null when the list is empty.
 */
export function selectPrimaryItem(items: ParsedItem[]): ParsedItem | null {
  if (items.length === 0) {
    return null;
  }

  const meaningful = items.filter((item) => !BOILERPLATE_CODES.has(item.code));
  const pool = meaningful.length > 0 ? meaningful : items;

  return pool.reduce((best, item) =>
    CATEGORY_PRIORITY[item.category] > CATEGORY_PRIORITY[best.category]
      ? item
      : best,
  );
}

const VALID_CATEGORIES = new Set<string>(Object.keys(CATEGORY_LABELS));

/**
 * Coerces the `item_codes` JSON column (typed `unknown` by the driver) into a
 * trusted `ParsedItem[]`, dropping anything malformed.
 *
 * @param value - Raw JSON value read from the database or API.
 * @returns A validated item list, empty when the value isn't a usable array.
 */
export function normalizeItemCodes(value: unknown): ParsedItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry): ParsedItem[] => {
    if (
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as ParsedItem).code === "string" &&
      typeof (entry as ParsedItem).label === "string" &&
      VALID_CATEGORIES.has((entry as ParsedItem).category)
    ) {
      const item = entry as ParsedItem;
      return [{ code: item.code, label: item.label, category: item.category }];
    }
    return [];
  });
}

/**
 * Parses a raw 8-K feed summary into a headline, category, and item list.
 *
 * @param summary - Raw EDGAR Atom `summary` text.
 * @returns Structured filing signal; falls back to an "Other" filing when no
 *   recognizable item codes are present (e.g. non-8-K forms).
 */
export function parseFilingSummary(summary: string): ParsedFiling {
  const items = extractItems(summary);
  const primary = selectPrimaryItem(items);

  if (!primary) {
    return { items, primaryCategory: "other", headline: "Filing" };
  }

  return {
    items,
    primaryCategory: primary.category,
    headline: primary.label,
  };
}
