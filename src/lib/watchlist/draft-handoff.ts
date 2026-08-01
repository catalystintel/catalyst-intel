import type { WatchlistCriteria } from "@/db/schema";

/**
 * One-shot sessionStorage handoff from the Catalyst Feed's filter panel
 * ("Open in watchlist builder") to the `/watchlist` builder — lets a user
 * start from their current tape filters, then refine manually or with AI
 * before saving, instead of committing immediately.
 */
export const WATCHLIST_DRAFT_HANDOFF_KEY = "ci.watchlist-draft-handoff";

/** DOM id of the builder section on `/watchlist` — anchor target for deep links. */
export const WATCHLIST_BUILDER_ANCHOR = "watchlist-builder";

export interface WatchlistDraftHandoff {
  name?: string;
  criteria: WatchlistCriteria;
}

export function writeWatchlistDraftHandoff(
  handoff: WatchlistDraftHandoff,
): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    WATCHLIST_DRAFT_HANDOFF_KEY,
    JSON.stringify(handoff),
  );
}
