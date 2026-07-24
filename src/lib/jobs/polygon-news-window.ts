/**
 * Compute Polygon news `published_utc.gte` + page size from per-vendor state.
 * Pure (no DB) so unit tests can cover 429 catch-up without Turso.
 */

export type PolygonNewsWindowInput = {
  state: {
    lastFetchedAt: string | null;
    lastStatus: string;
  } | null;
  now?: Date;
};

export type PolygonNewsWindow = {
  sinceIso: string;
  limit: number;
  catchingUp: boolean;
  gapMs: number;
};

/** Small overlap so boundary articles are not lost between ticks. */
export const POLYGON_NEWS_OVERLAP_MS = 90_000;
/** First-run / empty watermark lookback. */
export const POLYGON_NEWS_DEFAULT_LOOKBACK_MS = 20 * 60_000;
/** Hard cap so a long outage does not request an unbounded range. */
export const POLYGON_NEWS_MAX_LOOKBACK_MS = 6 * 60 * 60_000;
/** Steady-state page size (1 req / cron tick). */
export const POLYGON_NEWS_NORMAL_LIMIT = 40;
/** After 429 or a wide gap — larger page so catch-up fits in one request. */
export const POLYGON_NEWS_CATCHUP_LIMIT = 100;
/** Gap above this forces catch-up limit even if last status was ok. */
export const POLYGON_NEWS_CATCHUP_GAP_MS = 3 * 60_000;

export function resolvePolygonNewsWindow(
  input: PolygonNewsWindowInput,
): PolygonNewsWindow {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const watermarkMs = input.state?.lastFetchedAt
    ? Date.parse(input.state.lastFetchedAt)
    : NaN;

  let sinceMs = Number.isFinite(watermarkMs)
    ? watermarkMs - POLYGON_NEWS_OVERLAP_MS
    : nowMs - POLYGON_NEWS_DEFAULT_LOOKBACK_MS;

  sinceMs = Math.max(sinceMs, nowMs - POLYGON_NEWS_MAX_LOOKBACK_MS);

  const gapMs = Number.isFinite(watermarkMs)
    ? Math.max(0, nowMs - watermarkMs)
    : POLYGON_NEWS_DEFAULT_LOOKBACK_MS;

  const catchingUp =
    !input.state?.lastFetchedAt ||
    input.state?.lastStatus === "rate_limited" ||
    (Number.isFinite(watermarkMs) && gapMs >= POLYGON_NEWS_CATCHUP_GAP_MS);

  return {
    sinceIso: new Date(sinceMs).toISOString(),
    limit: catchingUp ? POLYGON_NEWS_CATCHUP_LIMIT : POLYGON_NEWS_NORMAL_LIMIT,
    catchingUp,
    gapMs,
  };
}
