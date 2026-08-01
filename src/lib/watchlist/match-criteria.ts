import type { WatchlistCriteria } from "@/db/schema";
import { formBucketFromType } from "@/lib/catalysts/feed-form-filters";

/**
 * Fields a client-side matcher needs from an already-fetched catalyst.
 * Deliberately loose (all optional except symbol/eventCategory) so callers
 * with a partial `FeedCatalyst` shape don't need to pad it out.
 */
export interface MatchableCatalyst {
  symbol: string | null;
  eventCategory: string | null;
  type?: string | null;
  tags?: string[] | null;
  sourceProvider?: string | null;
  companyName?: string | null;
  title?: string | null;
  headline?: string | null;
}

/**
 * Client-side mirror of `buildFeedWhere` (lib/catalysts/feed-query.ts) for a
 * single already-fetched catalyst — used where round-tripping to the query
 * engine per row isn't practical (e.g. Quiet mode's client-side filter over
 * rows already in memory).
 *
 * **Keep in sync with `buildFeedWhere`**: AND across axes, any-match within
 * an axis, empty/omitted axis = unconstrained. This is the one sanctioned
 * client-side implementation — don't add another ad hoc criteria matcher.
 */
export function matchesWatchlistCriteria(
  catalyst: MatchableCatalyst,
  criteria: WatchlistCriteria,
): boolean {
  if (criteria.symbols?.length) {
    const symbol = catalyst.symbol?.trim().toUpperCase() ?? "";
    if (!symbol || !criteria.symbols.includes(symbol)) return false;
  }

  if (criteria.categories?.length) {
    if (
      !catalyst.eventCategory ||
      !criteria.categories.includes(catalyst.eventCategory)
    ) {
      return false;
    }
  }

  if (criteria.forms?.length) {
    const bucket = formBucketFromType(catalyst.type);
    if (!criteria.forms.includes(bucket)) return false;
  }

  if (criteria.tags?.length) {
    const have = new Set(
      (catalyst.tags ?? [])
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.toLowerCase()),
    );
    if (!criteria.tags.some((t) => have.has(t.toLowerCase()))) return false;
  }

  if (criteria.sources?.length) {
    const provider = catalyst.sourceProvider?.toLowerCase() ?? "";
    if (!provider || !criteria.sources.includes(provider)) return false;
  }

  if (criteria.q?.trim()) {
    const q = criteria.q.trim().toLowerCase();
    const haystacks = [
      catalyst.symbol,
      catalyst.companyName,
      catalyst.title,
      catalyst.headline,
    ]
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.toLowerCase());
    if (!haystacks.some((h) => h.includes(q))) return false;
  }

  return true;
}
