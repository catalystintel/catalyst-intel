/**
 * Turns the raw SEC 8-K feed summary into trader-meaningful signal.
 *
 * The EDGAR Atom feed already embeds the filing's Item codes and their official
 * descriptions in the summary text (e.g. "Item 5.02: Departure of Directors..."),
 * but the official wording is long and legalese. We map each code to a short
 * label and a category, and pick the single most market-moving item as the
 * headline - an 8-K's Item code is the whole reason a trader cares which one it is.
 */

import {
  CATEGORY_LABELS,
  CATEGORY_PRIORITY,
  VALID_EVENT_CATEGORIES,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";

export type { EventCategoryKey };
export { CATEGORY_LABELS, CATEGORY_PRIORITY };

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

interface ItemMeta {
  label: string;
  category: EventCategoryKey;
}

const ITEM_CATALOG: Record<string, ItemMeta> = {
  "1.01": { label: "Material Agreement", category: "deals" },
  "1.02": { label: "Agreement Terminated", category: "deals" },
  "1.03": { label: "Bankruptcy / Receivership", category: "distress" },
  "1.04": { label: "Mine Safety", category: "other" },
  "1.05": { label: "Material Cybersecurity Incident", category: "cyber" },
  "2.01": { label: "Acquisition / Disposition Closed", category: "deals" },
  "2.02": { label: "Earnings / Results", category: "earnings" },
  "2.03": { label: "New Financial Obligation", category: "capital" },
  "2.04": { label: "Debt Acceleration", category: "distress" },
  "2.05": { label: "Restructuring / Exit Costs", category: "restructuring" },
  "2.06": { label: "Material Impairment", category: "distress" },
  "3.01": { label: "Delisting Risk", category: "distress" },
  "3.02": { label: "Unregistered Equity Sale", category: "capital" },
  "3.03": { label: "Security Holder Rights Change", category: "capital" },
  "4.01": { label: "Auditor Change", category: "governance" },
  "4.02": { label: "Financials Non-Reliance", category: "distress" },
  "5.01": { label: "Change of Control", category: "deals" },
  "5.02": { label: "Officer / Director Change", category: "management" },
  "5.03": { label: "Charter / Bylaw Change", category: "governance" },
  "5.04": { label: "Trading Blackout", category: "governance" },
  "5.05": { label: "Ethics Code Change", category: "governance" },
  "5.07": { label: "Shareholder Vote", category: "governance" },
  "5.08": { label: "Director Nominations", category: "governance" },
  "7.01": { label: "Reg FD Disclosure", category: "disclosure" },
  "8.01": { label: "Other Event", category: "disclosure" },
  "9.01": { label: "Exhibits", category: "other" },
};

/** Short 8-K item labels used as feed headlines (e.g. "Earnings / results"). */
export const SEC_ITEM_HEADLINE_LABELS = new Set(
  Object.values(ITEM_CATALOG).map((m) => m.label.toLowerCase()),
);

/** True when text is just a catalog 8-K item label (not a company-specific story). */
export function isSecCatalogHeadline(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim().toLowerCase();
  return Boolean(t) && SEC_ITEM_HEADLINE_LABELS.has(t);
}

/**
 * Official SEC item description from an Atom summary, e.g.
 * "Item 5.02: Departure of Directors…" → "Departure of Directors…".
 */
export function extractSecItemBlurb(
  summary: string | null | undefined,
  itemCode?: string | null,
  maxChars = 110,
): string | null {
  const text = summary?.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const code = itemCode?.trim();
  const pattern = code
    ? new RegExp(
        `Item\\s+${code.replace(".", "\\.")}\\s*:\\s*(.+?)(?=\\s*Item\\s+\\d+\\.\\d+|$)`,
        "i",
      )
    : /Item\s+\d+\.\d+\s*:\s*(.+?)(?=\s*Item\s+\d+\.\d+|$)/i;

  const match = text.match(pattern);
  let blurb = match?.[1]?.trim() ?? null;
  if (!blurb) return null;

  blurb = blurb
    .replace(/\s+(?:Filed|AccNo|Acc-no|Size)\s*:.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!blurb || blurb.length < 12) return null;

  if (blurb.length > maxChars) {
    const cut = blurb.slice(0, maxChars);
    const sp = cut.lastIndexOf(" ");
    blurb = `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`;
  }
  return blurb;
}

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
      VALID_EVENT_CATEGORIES.has((entry as ParsedItem).category)
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
    return { items, primaryCategory: "other", headline: "Current report" };
  }

  return {
    items,
    primaryCategory: primary.category,
    headline: primary.label,
  };
}

/** Maps non-8-K SEC form types into category / headline / subcategory. */
export function classifySecFormType(formType: string): {
  category: EventCategoryKey;
  headline: string;
  subcategory: string;
  tags: string[];
} {
  const form = formType.trim().toUpperCase();

  if (form === "4" || form.startsWith("4/")) {
    return {
      category: "insider",
      headline: "Form 4 insider transaction",
      subcategory: "form4",
      tags: ["form4", "insider", "bz:insiders"],
    };
  }
  if (form.startsWith("S-3") || form.startsWith("424B")) {
    return {
      category: "capital",
      headline: form.startsWith("424B")
        ? "Prospectus / Offering (424B)"
        : "Shelf Registration (S-3)",
      subcategory: form.startsWith("424B") ? "424b" : "s3",
      tags: ["offering", "capital", "bz:secondary_offerings"],
    };
  }
  if (form === "425" || form.startsWith("425/")) {
    return {
      category: "deals",
      headline: "Merger / Acquisition (425)",
      subcategory: "425",
      tags: ["425", "ma", "bz:ma"],
    };
  }
  if (form.includes("13D")) {
    return {
      category: "deals",
      headline: "Schedule 13D",
      subcategory: "13d",
      tags: ["13d", "ownership", "bz:ma"],
    };
  }
  if (form.includes("13G")) {
    return {
      category: "governance",
      headline: "Schedule 13G",
      subcategory: "13g",
      tags: ["13g", "ownership", "bz:sec_filings"],
    };
  }
  if (form.startsWith("8-K")) {
    return {
      category: "disclosure",
      headline: "Current report",
      subcategory: "8k",
      tags: ["8k", "bz:sec_filings"],
    };
  }

  return {
    category: "other",
    headline: `${formType} filing`,
    subcategory: form.toLowerCase().replace(/\s+/g, "_"),
    tags: ["sec", "bz:sec_filings"],
  };
}
