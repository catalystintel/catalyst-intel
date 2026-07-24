/**
 * Analytics page time ranges. Deliberately separate from the Live feed's
 * `FeedTimeWindow` (feed-time-window.ts) - the feed is about "what just
 * happened", analytics is about "what's the shape of the last N days",
 * so it only needs a few coarse buckets.
 */
export type AnalyticsWindow = "24h" | "7d" | "30d";

export const ANALYTICS_WINDOWS: readonly {
  id: AnalyticsWindow;
  label: string;
  hours: number;
}[] = [
  { id: "24h", label: "24h", hours: 24 },
  { id: "7d", label: "7D", hours: 24 * 7 },
  { id: "30d", label: "30D", hours: 24 * 30 },
];

const WINDOW_IDS = new Set<string>(ANALYTICS_WINDOWS.map((w) => w.id));

export function isAnalyticsWindow(value: string): value is AnalyticsWindow {
  return WINDOW_IDS.has(value);
}

export function parseAnalyticsWindow(
  raw: string | null | undefined,
): AnalyticsWindow {
  if (raw && isAnalyticsWindow(raw)) return raw;
  return "24h";
}

export function hoursForAnalyticsWindow(window: AnalyticsWindow): number {
  return ANALYTICS_WINDOWS.find((w) => w.id === window)?.hours ?? 24;
}

/** ISO lower bound for `timestamp >= since`. */
export function sinceIsoForAnalyticsWindow(
  window: AnalyticsWindow,
  now = Date.now(),
): string {
  return new Date(
    now - hoursForAnalyticsWindow(window) * 60 * 60_000,
  ).toISOString();
}

/** Volume-trend bucket size: hourly for the 24h view, daily otherwise. */
export function bucketMinutesForAnalyticsWindow(
  window: AnalyticsWindow,
): number {
  return window === "24h" ? 60 : 24 * 60;
}
