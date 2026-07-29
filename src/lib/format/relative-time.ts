/**
 * Event-occurrence time formatters for the Live tape and detail surfaces.
 *
 * Always pass `catalysts.timestamp` (when the event occurred / was filed /
 * was published / is scheduled). Never pass `createdAt` / `fetchedAt` —
 * those are DB ingest metadata and must not be shown to traders as the
 * event clock.
 *
 * Wall-clock formatting uses the viewer's local timezone (omit `timeZone`
 * in Intl, or pass an explicit IANA zone for tests / SSR).
 */

export type FormatTimeOptions = {
  /** IANA zone; omit to use the runtime local timezone. */
  timeZone?: string;
};

function zoneOpts(timeZone?: string): { timeZone?: string } {
  return timeZone ? { timeZone } : {};
}

/** Short local zone label, e.g. `EDT`, `IDT`, `GMT+3`. */
function shortTimeZoneName(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZoneName: "short",
    ...zoneOpts(timeZone),
  }).formatToParts(date);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

/** Intraday-friendly relative age since the event occurred. */
export function formatRelativeAge(
  iso: string,
  now = Date.now(),
  options?: FormatTimeOptions,
): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";

  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 45) return `${Math.max(diffSec, 1)}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 86_400 * 7) return `${Math.floor(diffSec / 86_400)}d`;
  return new Date(iso).toLocaleDateString("en-US", {
    ...zoneOpts(options?.timeZone),
    month: "short",
    day: "numeric",
  });
}

/** Compact local clock for the feed's mobile Time cell. */
export function formatClockTime(
  iso: string,
  options?: FormatTimeOptions,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", {
    ...zoneOpts(options?.timeZone),
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Event time in the viewer's local zone: `10:23 AM IDT · Jul 20, 2026`.
 * Alias of the Live feed TIME column — always event occurrence, never ingest.
 */
export function formatTimeDate(
  iso: string,
  options?: FormatTimeOptions,
): string {
  return formatEventTime(iso, options);
}

export type EventTimeParts = {
  /** Local clock, e.g. `10:23 AM`. */
  clock: string;
  /** Short zone label, e.g. `EDT` / `GMT+3` (empty if unavailable). */
  zone: string;
  /** Local calendar day, e.g. `Jul 20, 2026`. */
  day: string;
};

/**
 * Structured event-occurrence parts for multi-line tape cells.
 * Prefer this when a single-line `formatEventTime` would force a wide column.
 */
export function formatEventTimeParts(
  iso: string,
  options?: FormatTimeOptions,
): EventTimeParts | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return {
    clock: date.toLocaleTimeString("en-US", {
      ...zoneOpts(options?.timeZone),
      hour: "numeric",
      minute: "2-digit",
    }),
    zone: shortTimeZoneName(date, options?.timeZone),
    day: date.toLocaleDateString("en-US", {
      ...zoneOpts(options?.timeZone),
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  };
}

/**
 * Canonical display of when the catalyst event occurred (filed / published /
 * scheduled). Prefer this over ad-hoc `new Date(...).toLocaleString()`.
 */
export function formatEventTime(
  iso: string,
  options?: FormatTimeOptions,
): string {
  const parts = formatEventTimeParts(iso, options);
  if (!parts) return "—";
  return parts.zone
    ? `${parts.clock} ${parts.zone} · ${parts.day}`
    : `${parts.clock} · ${parts.day}`;
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
