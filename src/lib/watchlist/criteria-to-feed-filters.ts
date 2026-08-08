import type { WatchlistCriteria } from "@/db/schema";
import { isFeedFormFilter } from "@/lib/catalysts/feed-form-filters";
import type { FeedQueryFilters } from "@/lib/catalysts/feed-query";
import { isEventCategoryKey } from "@/lib/catalysts/taxonomy";

/**
 * Maps a saved/draft watchlist's criteria onto the feed query engine so
 * preview endpoints (and, next phase, alert matching) share one definition
 * of "what does this rule match" with the live tape.
 */
export function criteriaToFeedFilters(
  criteria: WatchlistCriteria,
  nowIso: string,
): FeedQueryFilters {
  return {
    q: criteria.q ?? "",
    symbols: (criteria.symbols ?? []).map((s) => s.toUpperCase()),
    categories: (criteria.categories ?? []).filter(isEventCategoryKey),
    sectors: [],
    forms: (criteria.forms ?? []).filter(isFeedFormFilter),
    sources: (criteria.sources ?? []).map((s) => s.toLowerCase()),
    tags: (criteria.tags ?? []).map((t) => t.toLowerCase()),
    timeWindow: "all",
    symbolOnly: true,
    earningsSurprisesOnly: false,
    criteriaGroups: [],
    since: null,
    until: nowIso,
  };
}
