/**
 * Live feed time chips: filter by catalyst `timestamp` (article/filing post
 * time), newest → oldest.
 *
 * **Recent** = last 30 minutes — short enough for “just hit the wire” tape
 * scanning without being as noisy as a pure top-N slice.
 */
export type FeedTimeWindow = "recent" | "1h" | "4h" | "12h" | "24h" | "all";

export const RECENT_WINDOW_MINUTES = 30;

export const FEED_TIME_WINDOWS: readonly {
  id: FeedTimeWindow;
  label: string;
  /** null = unbounded (All). */
  minutes: number | null;
}[] = [
  { id: "recent", label: "Recent", minutes: RECENT_WINDOW_MINUTES },
  { id: "1h", label: "1h", minutes: 60 },
  { id: "4h", label: "4h", minutes: 4 * 60 },
  { id: "12h", label: "12h", minutes: 12 * 60 },
  { id: "24h", label: "24h", minutes: 24 * 60 },
  { id: "all", label: "All", minutes: null },
] as const;

const WINDOW_IDS = new Set<string>(FEED_TIME_WINDOWS.map((w) => w.id));

export function isFeedTimeWindow(value: string): value is FeedTimeWindow {
  return WINDOW_IDS.has(value);
}

export function parseFeedTimeWindow(
  raw: string | null | undefined,
): FeedTimeWindow {
  if (raw && isFeedTimeWindow(raw)) return raw;
  return "all";
}

export function minutesForFeedTimeWindow(
  window: FeedTimeWindow,
): number | null {
  return FEED_TIME_WINDOWS.find((w) => w.id === window)?.minutes ?? null;
}

/** ISO lower bound for `timestamp >= since`, or null when unbounded. */
export function sinceIsoForFeedTimeWindow(
  window: FeedTimeWindow,
  now = Date.now(),
): string | null {
  const minutes = minutesForFeedTimeWindow(window);
  if (minutes === null) return null;
  return new Date(now - minutes * 60_000).toISOString();
}

/** Soft-poll / list page size: wider windows need a higher limit. */
export function feedLimitForTimeWindow(window: FeedTimeWindow): number {
  return window === "all" ? 200 : 100;
}
