/**
 * Keyless US macro calendar for day traders (CPI / NFP / FOMC).
 * Uses published BLS + Fed schedules embedded in-repo — no API key.
 * BLS ICS is bot-blocked; do not scrape bls.gov from serverless.
 */

import {
  formatCpiTitle,
  formatFomcRateDecisionTitle,
  formatJobsReportTitle,
} from "@/lib/catalysts/catalyst-titles";
import {
  ingestNormalizedCatalysts,
  toSourceResult,
  type NormalizedCatalyst,
  type SourceFetchResult,
} from "@/lib/jobs/ingest-pipeline";

export interface MacroEventDef {
  /** Stable id slug, e.g. cpi-2026-08-12 */
  id: string;
  /** ISO date YYYY-MM-DD (release / decision day) */
  date: string;
  /** ET clock for display, e.g. 08:30 */
  timeEt: string;
  title: string;
  subcategory: "cpi" | "nfp" | "fomc";
  summary: string;
}

/** BLS Consumer Price Index release days (8:30 ET) — 2026 remainder + early 2027. */
const CPI_DATES_2026_2027: Array<{ date: string; forMonth: string }> = [
  { date: "2026-08-12", forMonth: "July 2026" },
  { date: "2026-09-11", forMonth: "August 2026" },
  { date: "2026-10-14", forMonth: "September 2026" },
  { date: "2026-11-10", forMonth: "October 2026" },
  { date: "2026-12-10", forMonth: "November 2026" },
  { date: "2027-01-13", forMonth: "December 2026" },
  { date: "2027-02-10", forMonth: "January 2027" },
  { date: "2027-03-11", forMonth: "February 2027" },
];

/**
 * Employment Situation (NFP) release days — hardcoded where holidays move
 * the usual first-Friday pattern (e.g. Jul 2026 → Jul 2).
 */
const NFP_DATES_2026_2027: Array<{ date: string; forMonth: string }> = [
  { date: "2026-08-07", forMonth: "July 2026" },
  { date: "2026-09-04", forMonth: "August 2026" },
  { date: "2026-10-02", forMonth: "September 2026" },
  { date: "2026-11-06", forMonth: "October 2026" },
  { date: "2026-12-04", forMonth: "November 2026" },
  { date: "2027-01-08", forMonth: "December 2026" },
  { date: "2027-02-05", forMonth: "January 2027" },
  { date: "2027-03-05", forMonth: "February 2027" },
];

/** FOMC decision days (statement ~14:00 ET) — Fed tentative schedule. */
const FOMC_DECISION_DATES = [
  "2026-07-29",
  "2026-09-16",
  "2026-10-28",
  "2026-12-09",
  "2027-01-27",
  "2027-03-17",
];

function etTimestamp(date: string, timeEt: string): string {
  // Store as noon UTC on the calendar day when time is unknown; otherwise
  // approximate ET→UTC with a fixed -4 offset (EDT). Good enough for feed sort.
  const [hh, mm] = timeEt.split(":").map((n) => Number(n));
  const utcHour = (hh ?? 12) + 4;
  return new Date(
    `${date}T${String(utcHour).padStart(2, "0")}:${String(mm ?? 0).padStart(2, "0")}:00.000Z`,
  ).toISOString();
}

/**
 * Upcoming macro events from today forward (inclusive), within `horizonDays`.
 */
export function buildUpcomingMacroEvents(
  now = new Date(),
  horizonDays = 120,
): MacroEventDef[] {
  const today = now.toISOString().slice(0, 10);
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + horizonDays);
  const endDay = end.toISOString().slice(0, 10);

  const events: MacroEventDef[] = [];

  for (const row of CPI_DATES_2026_2027) {
    if (row.date < today || row.date > endDay) continue;
    events.push({
      id: `cpi-${row.date}`,
      date: row.date,
      timeEt: "08:30",
      title: formatCpiTitle(row.forMonth),
      subcategory: "cpi",
      summary: `Consumer Price Index release (${row.forMonth} data) · 8:30 AM ET · BLS`,
    });
  }

  for (const row of NFP_DATES_2026_2027) {
    if (row.date < today || row.date > endDay) continue;
    events.push({
      id: `nfp-${row.date}`,
      date: row.date,
      timeEt: "08:30",
      title: formatJobsReportTitle(row.forMonth),
      subcategory: "nfp",
      summary: `Nonfarm payrolls & unemployment (${row.forMonth}) · 8:30 AM ET · BLS`,
    });
  }

  for (const date of FOMC_DECISION_DATES) {
    if (date < today || date > endDay) continue;
    events.push({
      id: `fomc-${date}`,
      date,
      timeEt: "14:00",
      title: formatFomcRateDecisionTitle(),
      subcategory: "fomc",
      summary:
        "FOMC statement · ~2:00 PM ET · Federal Reserve (tentative schedule)",
    });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

function toNormalized(event: MacroEventDef): NormalizedCatalyst {
  return {
    provider: "macro-calendar",
    externalId: `macro:${event.id}`,
    url:
      event.subcategory === "fomc"
        ? "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"
        : "https://www.bls.gov/schedule/",
    rawContent: event,
    ticker: null,
    companyName: "US Macro",
    type: "Economics",
    title: event.title,
    headline: "Macro calendar",
    eventCategory: "macro",
    subcategory: event.subcategory,
    timestamp: etTimestamp(event.date, event.timeEt),
    summary: event.summary,
    confidence: 80,
    tags: ["macro", "economics", event.subcategory, "keyless"],
  };
}

/**
 * Ingest upcoming CPI / NFP / FOMC dates. Always configured (keyless).
 */
export async function fetchMacroCalendar(options?: {
  now?: Date;
  horizonDays?: number;
}): Promise<SourceFetchResult> {
  const events = buildUpcomingMacroEvents(
    options?.now,
    options?.horizonDays ?? 120,
  );
  const normalized = events.map(toNormalized);
  const result = await ingestNormalizedCatalysts(normalized, { purge: false });
  return toSourceResult("macro-calendar", result);
}
