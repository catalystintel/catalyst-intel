/**
 * Ground-rule title formatters for API-ingested catalyst subjects.
 * Halts / FDA Approval / Earnings — keep formats stable for tape + Read.
 */

import { haltReasonLabel } from "@/lib/catalysts/halt-reason-codes";

/** Prefer a real company/issue/sponsor name; never emit empty parentheses. */
export function resolveDisplayCompanyName(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const name = candidate?.replace(/\s+/g, " ").trim();
    if (!name) continue;
    // Guard against accidental empty / paren-only junk from vendors.
    if (/^\(\s*\)$/.test(name)) continue;
    return name;
  }
  return "Unknown company";
}

/** `Halts (Company Name) — {reason}` */
export function formatHaltTitle(
  companyName: string | null | undefined,
  reasonCodeOrLabel: string | null | undefined,
  options?: { reasonIsLabel?: boolean },
): string {
  const company = resolveDisplayCompanyName(companyName);
  const reason = options?.reasonIsLabel
    ? resolveDisplayCompanyName(reasonCodeOrLabel, "Reason unavailable")
    : haltReasonLabel(reasonCodeOrLabel);
  return `Halts (${company}) — ${reason}`;
}

/** `FDA Approval - {Company Name}` */
export function formatFdaApprovalTitle(
  companyName: string | null | undefined,
): string {
  return `FDA Approval - ${resolveDisplayCompanyName(companyName)}`;
}

/**
 * Map a report period into Q1–Q4 for ground-rule earnings titles.
 *
 * Priority:
 * 1. Explicit Finnhub `quarter` (1–4) when present
 * 2. Calendar quarter of a concrete date (period end, earnings date, or
 *    SEC `Filed:` / filing timestamp) — fiscal-calendar heuristic when the
 *    issuer does not supply a quarter field
 * 3. `Q?` when nothing usable is available
 */
export function earningsQuarterLabel(
  quarter?: number | null,
  dateYmd?: string | null,
): string {
  if (
    typeof quarter === "number" &&
    Number.isFinite(quarter) &&
    quarter >= 1 &&
    quarter <= 4
  ) {
    return `Q${Math.trunc(quarter)}`;
  }

  const raw = dateYmd?.trim();
  if (raw) {
    const iso = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : raw;
    const parsed = new Date(`${iso}T12:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) {
      const month = parsed.getUTCMonth() + 1;
      if (month <= 3) return "Q1";
      if (month <= 6) return "Q2";
      if (month <= 9) return "Q3";
      return "Q4";
    }
  }

  return "Q?";
}

const MONTH_INDEX: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

/** Parse `YYYY-MM-DD` or `Month D, YYYY` into an ISO date (UTC-safe). */
function parseLooseYmd(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);

  const named = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (!named) return null;
  const month = MONTH_INDEX[named[1].toLowerCase()];
  const day = Number(named[2]);
  const year = Number(named[3]);
  if (!month || !Number.isFinite(day) || !Number.isFinite(year)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Best available date for quarter inference when Finnhub `quarter` is absent.
 * Prefers period-end wording, then SEC `Filed: YYYY-MM-DD`, then ISO timestamp.
 */
export function earningsDateForQuarterInference(options: {
  periodEndYmd?: string | null;
  summary?: string | null;
  timestamp?: string | null;
}): string | null {
  const periodEnd = parseLooseYmd(options.periodEndYmd ?? "");
  if (periodEnd) return periodEnd;

  const summary = options.summary?.replace(/\s+/g, " ") ?? "";
  const periodMatch = summary.match(
    /(?:quarter|period|three months)\s+ended\s+(\d{4}-\d{2}-\d{2}|[A-Za-z]+\s+\d{1,2},\s+\d{4})/i,
  );
  const fromPeriod = periodMatch?.[1] ? parseLooseYmd(periodMatch[1]) : null;
  if (fromPeriod) return fromPeriod;

  const filed = summary.match(/Filed:\s*(\d{4}-\d{2}-\d{2})/i)?.[1];
  if (filed) return filed;

  const ts = options.timestamp?.trim();
  if (ts && /^\d{4}-\d{2}-\d{2}/.test(ts)) return ts.slice(0, 10);
  return null;
}

/** `Earnings Report {Qn} - {Company Name}` */
export function formatEarningsReportTitle(
  quarterLabel: string,
  companyName: string | null | undefined,
): string {
  const q = quarterLabel.trim().toUpperCase().startsWith("Q")
    ? quarterLabel.trim().toUpperCase()
    : `Q${quarterLabel.trim()}`;
  return `Earnings Report ${q} - ${resolveDisplayCompanyName(companyName)}`;
}

/** True for SEC Item 2.02 / “Results of Operations…” style earnings subjects. */
export function looksLikeResultsOfOperationsTitle(
  ...texts: Array<string | null | undefined>
): boolean {
  return texts.some((text) =>
    /results of operations(?:\s+and\s+financial\s+condition)?/i.test(
      text ?? "",
    ),
  );
}
