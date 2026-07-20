import type { EventCategoryKey } from "@/lib/catalysts/taxonomy";
import { VALID_EVENT_CATEGORIES } from "@/lib/catalysts/taxonomy";

/** Default playbook: high-signal categories traders typically care about. */
export const DEFAULT_PLAYBOOK_CATEGORIES: EventCategoryKey[] = [
  "distress",
  "trading_halt",
  "earnings",
  "regulatory",
  "deals",
  "clinical",
  "restructuring",
  "capital",
  "management",
  "insider",
];

/**
 * Coerces untrusted JSON into a de-duplicated list of valid event categories.
 */
export function normalizePlaybookCategories(
  value: unknown,
): EventCategoryKey[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<EventCategoryKey>();
  for (const entry of value) {
    if (typeof entry === "string" && VALID_EVENT_CATEGORIES.has(entry)) {
      seen.add(entry as EventCategoryKey);
    }
  }
  return [...seen];
}

export interface QuietFilterInput {
  ticker: string | null;
  eventCategory: EventCategoryKey | null;
}

/**
 * Quiet-mode predicate: keep rows that match the watchlist (if any) and
 * playbook categories (if any). Empty lists mean "no constraint on that axis".
 */
export function matchesQuietPlaybook(
  row: QuietFilterInput,
  options: {
    quietMode: boolean;
    watchlistTickers: string[];
    playbookCategories: EventCategoryKey[];
  },
): boolean {
  if (!options.quietMode) return true;

  const watch = options.watchlistTickers.map((t) => t.toUpperCase());
  if (watch.length > 0) {
    const ticker = (row.ticker ?? "").toUpperCase();
    if (!ticker || !watch.includes(ticker)) return false;
  }

  if (options.playbookCategories.length > 0) {
    if (
      !row.eventCategory ||
      !options.playbookCategories.includes(row.eventCategory)
    ) {
      return false;
    }
  }

  return true;
}
