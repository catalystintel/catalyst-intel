import type { WatchlistCriteria } from "@/db/schema";
import type { EventCategoryKey } from "@/lib/catalysts/taxonomy";
import { VALID_EVENT_CATEGORIES } from "@/lib/catalysts/taxonomy";
import {
  matchesWatchlistCriteria,
  type MatchableCatalyst,
} from "@/lib/watchlist/match-criteria";

/**
 * Implicit default signal when a user has quiet mode on but has never
 * selected a watchlist or symbol as a signal source (first-time / legacy
 * `playbook_settings.categories` fallback) — see `matchesQuietPlaybook`.
 */
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
 * Legacy playbook shape; also reused by `normalizeAlertConditions` for the
 * unrelated alert-rule `categories` condition.
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

/** Coerces untrusted JSON into a de-duplicated, size-bounded id list. */
export function normalizeWatchlistIds(value: unknown, max = 20): number[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  for (const entry of value) {
    const n = typeof entry === "number" ? entry : Number(entry);
    if (Number.isFinite(n) && Number.isInteger(n) && n > 0) {
      seen.add(n);
      if (seen.size >= max) break;
    }
  }
  return [...seen];
}

/** A saved watchlist selected as a quiet-mode signal source. */
export interface QuietSignalWatchlist {
  id: number;
  criteria: WatchlistCriteria;
}

/**
 * Quiet-mode predicate: a row passes if it matches ANY configured signal
 * source — the flat "My symbols" watchlist (if non-empty) or any selected
 * saved watchlist's full criteria (symbols/categories/forms/tags/sources/q,
 * matched via `matchesWatchlistCriteria`). A watchlist is no longer just
 * "the one flat symbol list" — quiet mode can combine as many rule-based
 * sources as the user selects.
 *
 * With nothing configured (no symbols, no selected watchlists), falls back
 * to `DEFAULT_PLAYBOOK_CATEGORIES` so a first-time Quiet toggle isn't
 * silently empty.
 */
export function matchesQuietPlaybook(
  row: MatchableCatalyst,
  options: {
    quietMode: boolean;
    watchlistSymbols: string[];
    signalWatchlists: QuietSignalWatchlist[];
  },
): boolean {
  if (!options.quietMode) return true;

  const sources: WatchlistCriteria[] = [];
  if (options.watchlistSymbols.length > 0) {
    sources.push({
      symbols: options.watchlistSymbols.map((s) => s.toUpperCase()),
    });
  }
  for (const w of options.signalWatchlists) sources.push(w.criteria);

  if (sources.length === 0) {
    return Boolean(
      row.eventCategory &&
      DEFAULT_PLAYBOOK_CATEGORIES.includes(
        row.eventCategory as EventCategoryKey,
      ),
    );
  }

  return sources.some((criteria) => matchesWatchlistCriteria(row, criteria));
}
