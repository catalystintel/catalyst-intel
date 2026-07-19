/** Intraday-friendly relative age for the Live feed. */
export function formatRelativeAge(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";

  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 45) return `${Math.max(diffSec, 1)}s`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 86_400 * 7) return `${Math.floor(diffSec / 86_400)}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Wall-clock time (HH:MM) in the viewer's locale, for the feed's "Time" cell. */
export function formatClockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isWithinWindow(
  iso: string,
  windowHours: number | null,
  now = Date.now(),
): boolean {
  if (windowHours === null) return true;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return now - then <= windowHours * 3_600_000;
}
