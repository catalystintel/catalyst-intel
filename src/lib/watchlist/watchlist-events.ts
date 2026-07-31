/**
 * Lightweight same-tab bus so watchlist mutations (Live tape "Watch",
 * dashboard rail, full Watchlists page) refresh every listener without
 * prop-drilling or a remount.
 */
export const WATCHLIST_CHANGED_EVENT = "catalyst-intel:watchlist-changed";

export function notifyWatchlistChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WATCHLIST_CHANGED_EVENT));
}

export function subscribeWatchlistChanged(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(WATCHLIST_CHANGED_EVENT, handler);
  return () => window.removeEventListener(WATCHLIST_CHANGED_EVENT, handler);
}
