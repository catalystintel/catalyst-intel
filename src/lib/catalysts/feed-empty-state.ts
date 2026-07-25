import type { FeedTimeWindow } from "@/lib/catalysts/feed-time-window";

/**
 * Distinguishes “DB has no rows” from “filters/time window hid everything”.
 * Critical: a soft-refetch with `window=4h` can return `[]` even when the DB
 * has plenty of catalysts whose event times fall outside that window (ingest
 * can land older filings). Never treat that as “No catalysts yet.”
 */
export type FeedEmptyKind = "none" | "db" | "filters" | "quiet" | "time_window";

export function classifyFeedEmpty(input: {
  catalystCount: number;
  visibleCount: number;
  loading: boolean;
  filtersDefault: boolean;
  quietMode: boolean;
  timeWindow: FeedTimeWindow;
}): FeedEmptyKind {
  if (input.loading) return "none";
  if (input.visibleCount > 0) return "none";

  // Truly empty corpus only when no filter gates are active.
  if (input.catalystCount === 0 && input.filtersDefault && !input.quietMode) {
    return "db";
  }

  if (input.quietMode) return "quiet";

  if (input.timeWindow !== "all" && input.catalystCount === 0) {
    return "time_window";
  }

  return "filters";
}
