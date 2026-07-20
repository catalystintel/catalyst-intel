import type { AlertSession } from "@/db/schema";

/**
 * Classifies a UTC timestamp into a coarse US equity session bucket.
 * AH = after-hours (16:00–20:00 ET), PM = pre-market (04:00–09:30 ET),
 * RTH = regular trading hours, otherwise still "any"-matchable via RTH/AH/PM miss.
 */
export function classifySession(
  isoTimestamp: string,
  nowMs = Date.now(),
): AlertSession {
  void nowMs;
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "any";

  // Convert to America/New_York wall-clock minutes.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const mins = hour * 60 + minute;

  // Pre-market 04:00–09:30
  if (mins >= 4 * 60 && mins < 9 * 60 + 30) return "PM";
  // RTH 09:30–16:00
  if (mins >= 9 * 60 + 30 && mins < 16 * 60) return "RTH";
  // After-hours 16:00–20:00
  if (mins >= 16 * 60 && mins < 20 * 60) return "AH";

  return "any";
}

export function sessionMatches(
  filingSession: AlertSession,
  allowed: AlertSession[] | undefined,
): boolean {
  if (!allowed || allowed.length === 0) return true;
  if (allowed.includes("any")) return true;
  return allowed.includes(filingSession);
}
