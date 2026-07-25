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
 * Map Finnhub `quarter` (1–4) or a calendar/fiscal date into Q1–Q4.
 * Prefers the explicit quarter field when present.
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
