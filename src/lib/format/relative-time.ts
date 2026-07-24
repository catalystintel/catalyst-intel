/**
 * Event-occurrence time formatters for the Live tape and detail surfaces.
 *
 * Always pass `catalysts.timestamp` (when the event occurred / was filed /
 * was published / is scheduled). Never pass `createdAt` / `fetchedAt` —
 * those are DB ingest metadata and must not be shown to traders as the
 * event clock.
 *
 * Wall-clock formatting uses America/New_York (ET) — the US equity desk
 * convention — so the same filing reads identically for every user.
 */

const ET = "America/New_York";

/** Intraday-friendly relative age since the event occurred. */
export function formatRelativeAge(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";

  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 45) return `${Math.max(diffSec, 1)}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 86_400 * 7) return `${Math.floor(diffSec / 86_400)}d`;
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: ET,
    month: "short",
    day: "numeric",
  });
}

/** Compact ET clock for the feed's mobile Time cell. */
export function formatClockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", {
    timeZone: ET,
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Trading-desk event time: `10:23 AM ET · Jul 20, 2026`.
 * Alias of the Live feed TIME column — always event occurrence, never ingest.
 */
export function formatTimeDate(iso: string): string {
  return formatEventTime(iso);
}

/**
 * Canonical display of when the catalyst event occurred (filed / published /
 * scheduled). Prefer this over ad-hoc `new Date(...).toLocaleString()`.
 */
export function formatEventTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const time = date.toLocaleTimeString("en-US", {
    timeZone: ET,
    hour: "numeric",
    minute: "2-digit",
  });
  const day = date.toLocaleDateString("en-US", {
    timeZone: ET,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${time} ET · ${day}`;
}

/**
 * Whether `iso` (event occurrence) falls within the last `windowMinutes`
 * relative to `now`. Pass `null` for unbounded (All).
 *
 * Catalysts dated in the future (e.g. a scheduled FOMC/earnings date) are
 * never "within" a lookback window - a negative `now - then` used to pass
 * every check here (any negative number is <= a positive one), which made
 * a Nov 2026 macro event look like it just happened when scanning "Recent".
 */
export function isWithinWindow(
  iso: string,
  windowMinutes: number | null,
  now = Date.now(),
): boolean {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  if (then > now) return false;
  if (windowMinutes === null) return true;
  return now - then <= windowMinutes * 60_000;
}
