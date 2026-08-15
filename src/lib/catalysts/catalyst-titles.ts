/**
 * Ground-rule title formatters for API-ingested catalyst subjects.
 * Keep formats stable for tape + Details (see FEED-TITLE-GUIDELINES.md).
 */

import { haltReasonLabel } from "@/lib/catalysts/halt-reason-codes";
import { parseOfficerDirectorChange } from "@/lib/catalysts/officer-change";

export type { OfficerChangeAction } from "@/lib/catalysts/officer-change";

export type Sec8kTitleOptions = {
  /** Summary / raw filing text used for Item 5.02 role + action inference. */
  content?: string | null;
};

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

const TITLE_CASE_SMALL = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "in",
  "nor",
  "of",
  "on",
  "or",
  "the",
  "to",
  "vs",
]);

function titleCaseToken(token: string, forceCap: boolean): string {
  if (!token) return token;
  // Keep form / item tokens like 8-K, S-3, 424B, 13D as-is (aside from casing).
  if (/^(?:8-?K|S-3|424B\d*|(?:SC\s*)?13[DG](?:\/A)?)$/i.test(token)) {
    return token.toUpperCase().replace(/^SC\s*/i, "SC ");
  }
  // Short market / regulatory acronyms stay uppercase.
  if (/^(?:FD|FDA|SEC|NFP|CPI|FOMC|LULD|XML|IPO)$/i.test(token)) {
    return token.toUpperCase();
  }
  if (/^\d/.test(token)) return token;

  const lower = token.toLowerCase();
  if (!forceCap && TITLE_CASE_SMALL.has(lower)) return lower;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Title Case for 8-K / event labels (`Material Agreement`, `Change of Control`).
 * Slash compounds capitalize each side: `Officer / Director Change`.
 */
export function titleCaseEventLabel(label: string | null | undefined): string {
  const trimmed = label?.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";

  return trimmed
    .split(" ")
    .map((word, index) => {
      if (word === "/" || word === "-" || word === "—") return word;
      if (word.includes("/")) {
        return word
          .split("/")
          .map((part) => titleCaseToken(part, true))
          .join("/");
      }
      // Parenthetical form codes: `(S-3)`, `(424B)`, `(13D)`.
      const paren = word.match(/^\((.+)\)$/);
      if (paren) {
        return `(${titleCaseToken(paren[1], true)})`;
      }
      // Hyphenated compounds: `Non-Reliance` (form codes handled in token helper).
      if (word.includes("-") && !/^(?:8-?K|S-3)$/i.test(word)) {
        return word
          .split("-")
          .map((part) => titleCaseToken(part, true))
          .join("-");
      }
      return titleCaseToken(word, index === 0);
    })
    .join(" ");
}

/** `Halts ({Company Name}) - {reason}` */
export function formatHaltTitle(
  companyName: string | null | undefined,
  reasonCodeOrLabel: string | null | undefined,
  options?: { reasonIsLabel?: boolean },
): string {
  const company = resolveDisplayCompanyName(companyName);
  const reason = options?.reasonIsLabel
    ? resolveDisplayCompanyName(reasonCodeOrLabel, "Reason unavailable")
    : haltReasonLabel(reasonCodeOrLabel);
  return `Halts (${company}) - ${reason}`;
}

/** `{Company Name} Receives FDA Approval!` */
export function formatFdaApprovalTitle(
  companyName: string | null | undefined,
): string {
  return `${resolveDisplayCompanyName(companyName)} Receives FDA Approval!`;
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

/** `{Company} {Qn} earnings report` — distinct from Form 4 / shelf hyphen chips. */
export function formatEarningsReportTitle(
  quarterLabel: string,
  companyName: string | null | undefined,
): string {
  const q = quarterLabel.trim().toUpperCase().startsWith("Q")
    ? quarterLabel.trim().toUpperCase()
    : `Q${quarterLabel.trim()}`;
  return `${resolveDisplayCompanyName(companyName)} ${q} earnings report`;
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

/** `{Company} - Partnership or Major Contract Announced` (Item 1.01) */
export function formatMaterialAgreementTitle(
  companyName: string | null | undefined,
): string {
  return `${resolveDisplayCompanyName(companyName)} - Partnership or Major Contract Announced`;
}

/** `{Company} - Bankruptcy Filing (Equity at Risk)` (Item 1.03) */
export function formatBankruptcyFilingTitle(
  companyName: string | null | undefined,
): string {
  return `${resolveDisplayCompanyName(companyName)} - Bankruptcy Filing (Equity at Risk)`;
}

/** `{Company} - Delisting Risk (Stock Could Lose Its Listing)` (Item 3.01) */
export function formatDelistingRiskTitle(
  companyName: string | null | undefined,
): string {
  return `${resolveDisplayCompanyName(companyName)} - Delisting Risk (Stock Could Lose Its Listing)`;
}

/**
 * Item 5.02 ground-rule title from company + optional filing text.
 *
 * Examples:
 * - `Acme Corp - CEO Change (Departure)`
 * - `Acme Corp - Executive Change (Appointment)` (role unknown)
 * - `Acme Corp - Executive Change` (role and action unknown)
 */
export function formatOfficerDirectorChangeTitle(
  companyName: string | null | undefined,
  options?: Sec8kTitleOptions,
): string {
  const company = resolveDisplayCompanyName(companyName);
  const { position, action } = parseOfficerDirectorChange(options?.content);

  if (position && action) {
    return `${company} - ${position} Change (${action})`;
  }
  if (!position && action) {
    return `${company} - Executive Change (${action})`;
  }
  if (position && !action) {
    return `${company} - ${position} Change`;
  }
  return `${company} - Executive Change`;
}

/**
 * Narrative tape titles for high-signal 8-K items (company-first).
 * Other items use `{Company} - {Label}`.
 */
const NARRATIVE_8K_BY_LABEL: Record<
  string,
  (
    companyName: string | null | undefined,
    options?: Sec8kTitleOptions,
  ) => string
> = {
  "material agreement": (company) => formatMaterialAgreementTitle(company),
  "bankruptcy / receivership": (company) =>
    formatBankruptcyFilingTitle(company),
  "delisting risk": (company) => formatDelistingRiskTitle(company),
  "officer / director change": formatOfficerDirectorChangeTitle,
  "acquisition / disposition closed": (company) =>
    formatAcquisitionClosedTitle(company),
  "acquisition closed": (company) => formatAcquisitionClosedTitle(company),
};

/**
 * Ground-rule 8-K title from the primary item label.
 * Narrative items (1.01 / 1.03 / 3.01 / 5.02) use company-first copy; others
 * use `{Company} - {Label}`. Earnings (Item 2.02) should use
 * {@link formatEarningsReportTitle} instead.
 */
export function formatSec8kItemTitle(
  itemLabel: string | null | undefined,
  companyName: string | null | undefined,
  options?: Sec8kTitleOptions,
): string {
  const key = itemLabel?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
  const narrative = NARRATIVE_8K_BY_LABEL[key];
  if (narrative) return narrative(companyName, options);

  const label = titleCaseEventLabel(itemLabel) || "Current Report";
  return `${resolveDisplayCompanyName(companyName)} - ${label}`;
}

/** True for current or legacy Item 5.02 executive-change tape titles. */
export function looksLikeOfficerDirectorChangeTitle(
  title: string | null | undefined,
): boolean {
  const t = title?.replace(/\s+/g, " ").trim() ?? "";
  if (!t) return false;
  if (/—\s*Executive Change\s*—/i.test(t)) return true;
  if (
    /(?::|\s-)\s*Executive Change(?:\s*\((?:Departure|Appointment)\))?$/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/\bExecutive Change\b/i.test(t)) return true;
  if (/\bOfficer Change\b/i.test(t)) return true;
  if (
    /\b(?:CEO|CFO|COO|CTO|CMO|CRO|CISO|CHRO|CIO|CPO|CLO|CCO|President)\s+Change(?:\s*(?:-|:)?\s*(?:Departure|Appointment)|\s*\((?:Departure|Appointment)\))?$/i.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

export type Form4TitleKind = "buy" | "sell" | "mixed" | "transaction";

/**
 * Form 4 titles — buy/sell voice, not identical `{Company} - Form 4 Insider …`.
 * Examples: `Acme Corp insider buy filed`, `Acme Corp insider sale filed`
 */
export function formatForm4InsiderTitle(
  kind: Form4TitleKind,
  companyName: string | null | undefined,
): string {
  const company = resolveDisplayCompanyName(companyName);
  switch (kind) {
    case "buy":
      return `${company} insider buy filed`;
    case "sell":
      return `${company} insider sale filed`;
    case "mixed":
      return `${company} Form 4 buy and sell`;
    default:
      return `${company} Form 4 insider filing`;
  }
}

/** Map Form 4 subcategory → ground-rule title kind. */
export function form4TitleKindFromSubcategory(
  subcategory: string | null | undefined,
): Form4TitleKind {
  switch (subcategory) {
    case "insider_buy":
      return "buy";
    case "insider_sell":
      return "sell";
    case "form4_mixed":
      return "mixed";
    default:
      return "transaction";
  }
}

/** `{Company} - Shelf Registration Filed (Capital Raise Window)` (S-3) */
export function formatShelfRegistrationTitle(
  companyName: string | null | undefined,
): string {
  return `${resolveDisplayCompanyName(companyName)} - Shelf Registration Filed (Capital Raise Window)`;
}

/** `{Company} - Stock Offering Filed (Dilution Ahead)` (424B) */
export function formatProspectusOfferingTitle(
  companyName: string | null | undefined,
): string {
  return `${resolveDisplayCompanyName(companyName)} - Stock Offering Filed (Dilution Ahead)`;
}

/** `{Company} - Acquisition Announced (Deal in Play)` (Form 425) */
export function format425MergerTitle(
  companyName: string | null | undefined,
): string {
  return `${resolveDisplayCompanyName(companyName)} - Acquisition Announced (Deal in Play)`;
}

/** `{Company} - Acquisition Closed` (Item 2.01) */
export function formatAcquisitionClosedTitle(
  companyName: string | null | undefined,
): string {
  return `${resolveDisplayCompanyName(companyName)} - Acquisition Closed`;
}

/** `{Company} - Strategic Partnership Announced` — thin partnership / collab fallback. */
export function formatPartnershipTitle(
  companyName: string | null | undefined,
): string {
  return `${resolveDisplayCompanyName(companyName)} - Strategic Partnership Announced`;
}

/** `{Company} reports active stake (13D)` */
export function formatSchedule13DTitle(
  companyName: string | null | undefined,
): string {
  return `${resolveDisplayCompanyName(companyName)} reports active stake (13D)`;
}

/** `{Company} reports passive stake (13G)` */
export function formatSchedule13GTitle(
  companyName: string | null | undefined,
): string {
  return `${resolveDisplayCompanyName(companyName)} reports passive stake (13G)`;
}

/** `{Company} - Clinical Trial Results Update` — thin clinical fallback. */
export function formatClinicalTrialTitle(
  companyName: string | null | undefined,
): string {
  return `${resolveDisplayCompanyName(companyName)} - Clinical Trial Results Update`;
}

/** `{Company} - Regulatory Action Update` — thin non-approval regulatory fallback. */
export function formatRegulatoryActionTitle(
  companyName: string | null | undefined,
): string {
  return `${resolveDisplayCompanyName(companyName)} - Regulatory Action Update`;
}

/** `CPI — {Month Year}` */
export function formatCpiTitle(forMonth: string | null | undefined): string {
  const month = forMonth?.replace(/\s+/g, " ").trim() || "Month unavailable";
  return `CPI — ${month}`;
}

/** `Jobs Report (NFP) — {Month Year}` */
export function formatJobsReportTitle(
  forMonth: string | null | undefined,
): string {
  const month = forMonth?.replace(/\s+/g, " ").trim() || "Month unavailable";
  return `Jobs Report (NFP) — ${month}`;
}

/** `FOMC Rate Decision` */
export function formatFomcRateDecisionTitle(): string {
  return "FOMC Rate Decision";
}

/** `{Company} price target update` */
export function formatPriceTargetTitle(
  companyName: string | null | undefined,
): string {
  return `${resolveDisplayCompanyName(companyName)} price target update`;
}

/** `{Company} Street rating change` */
export function formatAnalystRatingTitle(
  companyName: string | null | undefined,
): string {
  return `${resolveDisplayCompanyName(companyName)} Street rating change`;
}
