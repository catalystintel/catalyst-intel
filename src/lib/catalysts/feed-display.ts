import {
  CATEGORY_LABELS,
  extractSecItemBlurb,
  isSecCatalogHeadline,
  SEC_ITEM_HEADLINE_LABELS,
  selectPrimaryItem,
  type EventCategoryKey,
} from "@/lib/jobs/parse-8k-items";
import { benzingaPanelForCategory } from "@/lib/catalysts/benzinga-analogs";
import type { FeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import {
  earningsDateForQuarterInference,
  earningsQuarterLabel,
  format425MergerTitle,
  formatAnalystRatingTitle,
  formatClinicalTrialTitle,
  formatCpiTitle,
  formatEarningsReportTitle,
  formatFdaApprovalTitle,
  formatFomcRateDecisionTitle,
  formatForm4InsiderTitle,
  formatHaltTitle,
  formatJobsReportTitle,
  formatPriceTargetTitle,
  formatProspectusOfferingTitle,
  formatSchedule13DTitle,
  formatSchedule13GTitle,
  formatOfficerDirectorChangeTitle,
  formatSec8kItemTitle,
  formatShelfRegistrationTitle,
  form4TitleKindFromSubcategory,
  looksLikeOfficerDirectorChangeTitle,
  looksLikeResultsOfOperationsTitle,
  titleCaseEventLabel,
} from "@/lib/catalysts/catalyst-titles";
import {
  formatSeekingAlphaTitle,
  isSeekingAlphaCatalyst,
  isSeekingAlphaSource,
} from "@/lib/catalysts/seeking-alpha-titles";

/** Summary (+ title/headline fallback) for Item 5.02 role/action parsing. */
function officerChangeContent(c: FeedCatalyst): string {
  return [c.summary, c.title, c.headline]
    .map((t) => t?.replace(/\s+/g, " ").trim())
    .filter((t): t is string => Boolean(t && t.length > 0))
    .join("\n");
}

function formatOfficerChangeForCatalyst(
  c: FeedCatalyst,
  subject: string | null | undefined,
): string {
  return formatOfficerDirectorChangeTitle(subject, {
    content: officerChangeContent(c),
  });
}

export interface SourceDisplay {
  name: string;
  meta: string;
  initial: string;
  tone: "sec" | "wire" | "generic";
}

const PROVIDER_DISPLAY: Record<string, Omit<SourceDisplay, "meta">> = {
  "sec-edgar": { name: "Filings", initial: "F", tone: "sec" },
  "nasdaq-halts": { name: "Halt", initial: "H", tone: "generic" },
  "macro-calendar": { name: "Macro", initial: "M", tone: "generic" },
  "fmp-econ-calendar": { name: "Macro", initial: "E", tone: "generic" },
  "pr-wire": { name: "Press release", initial: "P", tone: "wire" },
  finnhub: { name: "Calendar", initial: "C", tone: "generic" },
  polygon: { name: "News", initial: "N", tone: "generic" },
  openfda: { name: "Regulatory", initial: "R", tone: "generic" },
  clinicaltrials: { name: "Clinical", initial: "C", tone: "generic" },
  form4api: { name: "Form 4", initial: "4", tone: "generic" },
};

/**
 * Maps a catalyst's provider / filing type into a display name for muted meta.
 * Wire rows surface as Press release (never a vendor or wire-house brand).
 */
export function sourceDisplay(c: FeedCatalyst): SourceDisplay {
  if (
    c.sourceProvider === "pr-wire" ||
    c.subcategory === "pr_wire" ||
    c.subcategory === "press_release" ||
    c.type === "Press Release" ||
    c.type === "Wire"
  ) {
    const meta =
      [c.type?.trim() || "Press release", c.symbol?.trim()]
        .filter(Boolean)
        .join(" · ") || "Press release";
    return { name: "Press release", meta, initial: "P", tone: "wire" };
  }

  const isWire =
    (c.sourceProvider === "polygon" &&
      (/wire/i.test(c.type ?? "") ||
        c.subcategory === "benzinga_wire" ||
        c.subcategory === "press_release" ||
        /benzinga wire/i.test(c.headline ?? ""))) ||
    c.type === "Press Release";

  if (isWire) {
    const meta =
      [c.type?.trim() || "Press release", c.symbol?.trim()]
        .filter(Boolean)
        .join(" · ") || "Press release";
    return { name: "Press release", meta, initial: "P", tone: "wire" };
  }

  const known = c.sourceProvider
    ? PROVIDER_DISPLAY[c.sourceProvider]
    : undefined;
  const name = known?.name ?? (c.sourceProvider?.trim() || "Unknown");
  const initial = known?.initial ?? (name.charAt(0).toUpperCase() || "?");
  const panel = benzingaPanelForCategory(c.eventCategory);
  const meta =
    [c.type?.trim(), c.symbol?.trim(), panel && !c.symbol ? panel : null]
      .filter(Boolean)
      .join(" · ") || "Source";
  return {
    name,
    meta,
    initial,
    tone: known?.tone ?? "generic",
  };
}

/**
 * Sector column: company sector when present, else event category, else type fallback.
 */
export function sectorLabel(c: FeedCatalyst): string {
  const companySector = c.sector?.trim();
  if (companySector) return companySector;
  if (c.eventCategory && c.eventCategory in CATEGORY_LABELS) {
    return CATEGORY_LABELS[c.eventCategory as EventCategoryKey];
  }
  if (c.sourceProvider === "sec-edgar" || /^8-?K$/i.test(c.type)) {
    return "Filings";
  }
  return c.type?.trim() || "Other";
}

/**
 * Known provider / wire labels that must never appear as the title cell.
 * News ingest often stores publisher in `headline` and the real story in `title`.
 */
const SOURCE_DISPLAY_NAMES = [
  ...Object.values(PROVIDER_DISPLAY).map((p) => p.name),
  "Benzinga",
  "Benzinga Wire",
  "PR Wire",
  "RTPR",
  "SEC",
  "EDGAR",
  "Massive",
  "Yahoo",
  "Reuters",
  "Bloomberg",
  "CNBC",
  "MarketWatch",
  "Seeking Alpha",
  "SeekingAlpha",
  "Company news",
  "Market News",
];

const SOURCE_NAME_RE = new RegExp(
  [
    "SEC\\s*EDGAR",
    "SEC",
    "EDGAR",
    "Finnhub",
    "Benzinga(?:\\s+Wire)?",
    "PR\\s*Wire",
    "RTPR",
    "openFDA",
    "Polygon",
    "Massive",
    "Nasdaq\\s+Halts?",
    "ClinicalTrials(?:\\.gov)?",
    "Form4API",
    "Macro(?:\\s+Calendar)?",
    "Yahoo",
    "Reuters",
    "Bloomberg",
    "CNBC",
    "MarketWatch",
    "Seeking\\s*Alpha",
  ].join("|"),
  "i",
);

function normalizeDisplayText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** True when the whole string is essentially a source / publisher label. */
export function looksLikeSourceLabel(text: string): boolean {
  const t = normalizeDisplayText(text);
  if (!t) return false;
  if (isSeekingAlphaSource(t)) return true;
  const lower = t.toLowerCase();
  if (SOURCE_DISPLAY_NAMES.some((name) => name.toLowerCase() === lower)) {
    return true;
  }
  // Entire token is a known source (not a longer headline that merely mentions one)
  return new RegExp(`^(?:${SOURCE_NAME_RE.source})$`, "i").test(t);
}

/**
 * Strip provider prefixes/suffixes from a displayed title
 * (e.g. "Foo — SEC EDGAR", "Finnhub: Foo", "Bar — SEC").
 */
export function stripSourceNames(text: string): string {
  let out = normalizeDisplayText(text);
  if (!out) return out;

  // Leading "Source: …" / "Source — …"
  out = out.replace(
    new RegExp(`^(?:${SOURCE_NAME_RE.source})\\s*[:—–\\-]\\s*`, "i"),
    "",
  );
  // Trailing "… — Source" / "… | Source" / "… - Source"
  out = out.replace(
    new RegExp(`\\s*[—–\\-|]\\s*(?:${SOURCE_NAME_RE.source})\\s*$`, "i"),
    "",
  );
  // Bare trailing source token after whitespace
  out = out.replace(
    new RegExp(`\\s+(?:${SOURCE_NAME_RE.source})\\s*$`, "i"),
    "",
  );

  out = normalizeDisplayText(out);
  return out || normalizeDisplayText(text);
}

/** Other short taxonomy headlines that need company context on the tape. */
const GENERIC_EVENT_HEADLINES = new Set([
  ...SEC_ITEM_HEADLINE_LABELS,
  "form 4 insider transaction",
  "form 4 routine ownership",
  "insider buy (form 4)",
  "insider sell (form 4)",
  "form 4 insider buy & sell",
  "mixed insider transactions (form 4)",
  "beneficial ownership (13d)",
  "beneficial ownership (13g)",
  "schedule 13d",
  "schedule 13g",
  "prospectus / offering (424b)",
  "shelf registration (s-3)",
  "merger / acquisition (425)",
  "8-k filing",
  "current report",
  "filing",
  "earnings calendar",
  "fda catalyst",
  "trading halt",
  "halt resumed",
  "price target (street)",
  "analyst ratings (consensus)",
  "clinical trial update",
  "macro calendar",
]);

/** ClinicalTrials.gov status chips — keep in Event cell, not Title. */
const CLINICAL_STATUS_HEADLINES = new Set([
  "completed",
  "terminated",
  "suspended",
  "withdrawn",
  "recruiting",
  "active, not recruiting",
  "not yet recruiting",
  "enrolling by invitation",
  "clinical trial update",
]);

function isGenericEventHeadline(text: string): boolean {
  const t = normalizeDisplayText(text).toLowerCase();
  if (!t) return false;
  if (GENERIC_EVENT_HEADLINES.has(t)) return true;
  return isSecCatalogHeadline(t);
}

/** Company / symbol subject for composing richer tape titles. */
function tapeSubject(c: FeedCatalyst): string | null {
  const company = normalizeDisplayText(c.companyName ?? "");
  if (company) {
    // Drop filing-title chrome: "ACME CORP — 8-K filing"
    const stripped = company
      .replace(
        /\s*[—–\-]\s*(?:\d+-?[A-Z]|8-?K|Form\s*4|S-3|424B|425|SC\s*13).*$/i,
        "",
      )
      .trim();
    if (stripped.length >= 2) return stripped;
    return company;
  }
  const symbol = c.symbol?.trim().toUpperCase();
  return symbol || null;
}

export type TitleLineOptions = {
  /**
   * Max chars for SEC Atom item blurbs. Tape rows stay short (~110);
   * hover tooltips pass a higher cap so the full notice is readable.
   */
  maxBlurbChars?: number;
};

/**
 * Primary title cell — company + what happened, not a bare taxonomy chip.
 * Prefers real news headlines; for SEC catalog labels, compose
 * `Company — official item blurb` (or trader label) so the wide Title column
 * carries a usable event summary.
 */
/**
 * Ground-rule API titles are stored on `title` (and usually mirrored on
 * `headline`). Prefer them over generic taxonomy chips so the tape shows
 * `Halts (…)` / `{Company} Receives FDA Approval!` / `{Company} - Earnings Report Qn`.
 */
function prefersStoredGroundRuleTitle(c: FeedCatalyst, title: string): boolean {
  if (!title || looksLikeSourceLabel(title)) return false;
  if (/^Halts\s*\(/i.test(title)) return true;
  if (
    /^FDA Approval\s*-/i.test(title) ||
    /(?::|\s-)\s*FDA Approval$/i.test(title) ||
    /\bReceives FDA Approval!$/i.test(title)
  ) {
    return true;
  }
  if (
    /^Earnings Report\s+Q/i.test(title) ||
    /(?::|\s-)\s*Earnings Report\s+Q/i.test(title) ||
    /\bQ[1-4\?]\s+earnings report$/i.test(title)
  ) {
    return true;
  }
  if (
    /^Form 4 Insider\b/i.test(title) ||
    /(?::|\s-)\s*Form 4 Insider\b/i.test(title) ||
    /\binsider (?:buy|sale) filed$/i.test(title) ||
    /\bForm 4 (?:buy and sell|insider filing)$/i.test(title)
  ) {
    return true;
  }
  if (
    /^Shelf Registration \(S-3\)\s*-/i.test(title) ||
    /(?::|\s-)\s*Shelf Registration \(S-3\)$/i.test(title) ||
    /\bfiles shelf registration \(S-3\)$/i.test(title)
  ) {
    return true;
  }
  // Legacy and narrative 424B / 425 titles.
  if (/New Stock Offering Filed/i.test(title)) return true;
  if (/\bfiles stock offering \(dilution watch\)$/i.test(title)) return true;
  if (/^Prospectus \/ Offering \(424B\)\s*-/i.test(title)) return true;
  if (/—\s*Structured note/i.test(title)) return true;
  if (/Structured note pricing supplement/i.test(title)) return true;
  if (/Merger or Acquisition News/i.test(title)) return true;
  if (/\bAnnounces Acquisition\s*[—–-]\s*Deal in Play/i.test(title)) {
    return true;
  }
  if (
    /^Schedule 13[DG]\s*-/i.test(title) ||
    /(?::|\s-)\s*Schedule 13[DG]$/i.test(title) ||
    /\breports (?:active|passive) stake \(13[DG]\)$/i.test(title)
  ) {
    return true;
  }
  // Narrative 8-K company-first titles (1.01 / 1.03 / 3.01 / 5.02).
  if (/New Deal Announced/i.test(title)) return true;
  if (/Delisting Risk/i.test(title)) return true;
  if (/Bankruptcy Filing/i.test(title)) return true;
  if (looksLikeOfficerDirectorChangeTitle(title)) return true;
  if (
    /^Clinical Trial\s*-/i.test(title) ||
    /(?::|\s-)\s*Clinical Trial$/i.test(title) ||
    /\bclinical trial update$/i.test(title)
  ) {
    return true;
  }
  if (
    /^Price Target\s*-/i.test(title) ||
    /(?::|\s-)\s*Price Target$/i.test(title) ||
    /\bprice target update$/i.test(title)
  ) {
    return true;
  }
  if (
    /^Analyst Rating\s*-/i.test(title) ||
    /(?::|\s-)\s*Analyst Rating$/i.test(title) ||
    /\bStreet rating change$/i.test(title)
  ) {
    return true;
  }
  if (/^CPI\s*—/i.test(title)) return true;
  if (/^Jobs Report \(NFP\)\s*—/i.test(title)) return true;
  if (/^FOMC Rate Decision$/i.test(title)) return true;
  // 8-K ground-rule: `{Company} - {Item}` (also legacy colon / `{Item} - {Company}`).
  if (
    c.sourceProvider === "sec-edgar" &&
    /(?:8-?K|8k)/i.test(c.type) &&
    (/:\s*.+/.test(title) || /\s-\s/.test(title)) &&
    !/(?:8-?K|Form\s*4).*filing$/i.test(title)
  ) {
    return true;
  }

  if (c.sourceProvider === "nasdaq-halts") return true;
  if (c.sourceProvider === "macro-calendar") return true;
  if (c.sourceProvider === "fmp-econ-calendar") return true;
  if (c.type === "FDA Approval" || c.subcategory === "openfda_approval") {
    return true;
  }
  if (
    c.sourceProvider === "finnhub" &&
    c.eventCategory === "earnings" &&
    /earnings report/i.test(title)
  ) {
    return true;
  }
  return false;
}

/** Normalize legacy stored ground-rule titles to the current format. */
function canonicalizeGroundRuleTitle(c: FeedCatalyst, title: string): string {
  const subject = tapeSubject(c) ?? c.companyName ?? c.symbol;

  // Legacy macro wording.
  const nfpMonth = title.match(
    /^NFP\s*\/\s*Employment Situation\s*[—–-]\s*(.+)$/i,
  )?.[1];
  if (nfpMonth) return formatJobsReportTitle(nfpMonth);
  if (/^FOMC rate decision$/i.test(title)) {
    return formatFomcRateDecisionTitle();
  }
  const cpiMonth = title.match(/^CPI\s*[—–-]\s*(.+)$/i)?.[1];
  if (cpiMonth) return formatCpiTitle(cpiMonth);

  // Halts: em dash / colon → spaced hyphen separator.
  const halt = title.match(/^Halts\s*\((.+?)\)\s*[—–\-:]\s*(.+)$/i);
  if (halt) {
    return formatHaltTitle(halt[1], halt[2], { reasonIsLabel: true });
  }

  // Earnings / FDA / Form 4 / shelf / ownership / clinical / analyst.
  const earningsQ = title.match(
    /(?:^Earnings Report\s+(Q\d|\?)\s*-\s*(.+)$)|(?:^(.+?)(?::|\s-)\s*Earnings Report\s+(Q\d|\?)$)|(?:^(.+?)\s+(Q\d|\?)\s+earnings report$)/i,
  );
  if (earningsQ) {
    const q = earningsQ[1] ?? earningsQ[4] ?? earningsQ[6];
    const company = earningsQ[2] ?? earningsQ[3] ?? earningsQ[5] ?? subject;
    return formatEarningsReportTitle(q, company);
  }
  if (
    /^FDA Approval\s*-/i.test(title) ||
    /(?::|\s-)\s*FDA Approval$/i.test(title) ||
    /\bReceives FDA Approval!$/i.test(title)
  ) {
    const company =
      title.match(/^FDA Approval\s*-\s*(.+)$/i)?.[1] ??
      title.match(/^(.+?)(?::|\s-)\s*FDA Approval$/i)?.[1] ??
      title.match(/^(.+?)\s+Receives FDA Approval!$/i)?.[1] ??
      subject;
    return formatFdaApprovalTitle(company);
  }
  if (
    /Form 4 Insider\b/i.test(title) ||
    /\binsider (?:buy|sale) filed$/i.test(title) ||
    /\bForm 4 (?:buy and sell|insider filing)$/i.test(title)
  ) {
    if (/Buy\s*&\s*Sell|buy and sell/i.test(title)) {
      return formatForm4InsiderTitle("mixed", subject);
    }
    if (/\bbuy\b/i.test(title) && !/\b(sell|sale)\b/i.test(title)) {
      return formatForm4InsiderTitle("buy", subject);
    }
    if (/\b(sell|sale)\b/i.test(title) && !/\bbuy\b/i.test(title)) {
      return formatForm4InsiderTitle("sell", subject);
    }
    return formatForm4InsiderTitle("transaction", subject);
  }
  if (
    /^Shelf Registration \(S-3\)\s*-/i.test(title) ||
    /(?::|\s-)\s*Shelf Registration \(S-3\)$/i.test(title) ||
    /\bfiles shelf registration \(S-3\)$/i.test(title)
  ) {
    return formatShelfRegistrationTitle(subject);
  }
  if (
    /^Schedule 13D\s*-/i.test(title) ||
    /(?::|\s-)\s*Schedule 13D$/i.test(title) ||
    /\breports active stake \(13D\)$/i.test(title)
  ) {
    return formatSchedule13DTitle(subject);
  }
  if (
    /^Schedule 13G\s*-/i.test(title) ||
    /(?::|\s-)\s*Schedule 13G$/i.test(title) ||
    /\breports passive stake \(13G\)$/i.test(title)
  ) {
    return formatSchedule13GTitle(subject);
  }
  if (
    /^Clinical Trial\s*-/i.test(title) ||
    /(?::|\s-)\s*Clinical Trial$/i.test(title) ||
    /\bclinical trial update$/i.test(title)
  ) {
    return formatClinicalTrialTitle(subject);
  }
  if (
    /^Price Target\s*-/i.test(title) ||
    /(?::|\s-)\s*Price Target$/i.test(title) ||
    /\bprice target update$/i.test(title)
  ) {
    return formatPriceTargetTitle(subject);
  }
  if (
    /^Analyst Rating\s*-/i.test(title) ||
    /(?::|\s-)\s*Analyst Rating$/i.test(title) ||
    /\bStreet rating change$/i.test(title)
  ) {
    return formatAnalystRatingTitle(subject);
  }

  // Narrative / legacy 424B + 425 → current ground-rule titles.
  if (
    /New Stock Offering Filed/i.test(title) ||
    /^Prospectus \/ Offering \(424B\)\s*-/i.test(title) ||
    /\bfiles stock offering \(dilution watch\)$/i.test(title)
  ) {
    return formatProspectusOfferingTitle(subject);
  }
  if (
    /Merger or Acquisition News/i.test(title) ||
    /\bAnnounces Acquisition\s*[—–-]\s*Deal in Play/i.test(title)
  ) {
    const company =
      title.match(
        /^(.+?)\s+Announces Acquisition\s*[—–-]\s*Deal in Play$/i,
      )?.[1] ??
      title.match(/^(.+?):\s*Merger or Acquisition News/i)?.[1] ??
      subject;
    return format425MergerTitle(company);
  }

  // Narrative 8-K company-first titles → recompute with current company.
  if (/New Deal Announced/i.test(title)) {
    return formatSec8kItemTitle("Material Agreement", subject);
  }
  if (/Delisting Risk/i.test(title)) {
    return formatSec8kItemTitle("Delisting Risk", subject);
  }
  if (/Bankruptcy Filing/i.test(title)) {
    return formatSec8kItemTitle("Bankruptcy / Receivership", subject);
  }
  if (looksLikeOfficerDirectorChangeTitle(title)) {
    return formatOfficerChangeForCatalyst(c, subject);
  }

  // 8-K `{Company} - {label}` (also legacy `{Company}: {label}` / `{label} - {company}`).
  if (
    c.sourceProvider === "sec-edgar" &&
    /(?:8-?K|8k)/i.test(c.type ?? "") &&
    !/(?:8-?K|Form\s*4).*filing$/i.test(title)
  ) {
    const colon = title.match(/^(.+?):\s*(.+)$/);
    if (
      colon &&
      !looksLikeResultsOfOperationsTitle(colon[2]) &&
      !/^Form 4 Insider\b/i.test(colon[2]) &&
      !/^Earnings Report\s+Q/i.test(colon[2])
    ) {
      return formatSec8kItemTitle(colon[2], colon[1] || subject, {
        content: officerChangeContent(c),
      });
    }
    const hyphen = title.match(/^(.+?)\s-\s(.+)$/);
    if (hyphen) {
      const left = hyphen[1];
      const right = hyphen[2];
      // Legacy event-first: `{label} - {company}`.
      if (
        isSecCatalogHeadline(left) &&
        !looksLikeResultsOfOperationsTitle(left) &&
        !/^Form 4 Insider\b/i.test(left) &&
        !/^Earnings Report\s+Q/i.test(left)
      ) {
        return formatSec8kItemTitle(left, right || subject, {
          content: officerChangeContent(c),
        });
      }
      // Current ground-rule: `{company} - {label}`.
      if (
        !looksLikeResultsOfOperationsTitle(right) &&
        !/^Form 4 Insider\b/i.test(right) &&
        !/^Earnings Report\s+Q/i.test(right)
      ) {
        return formatSec8kItemTitle(right, left || subject, {
          content: officerChangeContent(c),
        });
      }
    }
  }

  return title;
}

/**
 * SEC Item 2.02 / Results of Operations rows (and matching legacy titles)
 * recompute to `{Company} - Earnings Report Qn` so the tape matches Finnhub
 * ground-rule titles even when the DB still has the old SEC wording.
 */
function earningsReportDisplayTitle(c: FeedCatalyst): string | null {
  const title = normalizeDisplayText(c.title ?? "");
  const headline = normalizeDisplayText(c.headline ?? "");
  const hasItem202 = c.items.some((i) => i.code === "2.02");
  const earningsChip =
    c.eventCategory === "earnings" &&
    (isGenericEventHeadline(headline) ||
      /^earnings\s*\/\s*results$/i.test(headline));
  const resultsWording = looksLikeResultsOfOperationsTitle(
    title,
    headline,
    c.summary,
  );

  if (!hasItem202 && !earningsChip && !resultsWording) return null;

  // Keep real earnings news headlines; only rewrite taxonomy / Item 2.02 copy.
  if (
    headline &&
    !looksLikeSourceLabel(headline) &&
    !isGenericEventHeadline(headline) &&
    !looksLikeResultsOfOperationsTitle(headline) &&
    !/^Earnings Report\s+Q/i.test(headline) &&
    !/(?::|\s-)\s*Earnings Report\s+Q/i.test(headline) &&
    !/\bQ[1-4\?]\s+earnings report$/i.test(headline)
  ) {
    return null;
  }

  if (
    /^Earnings Report\s+Q/i.test(title) ||
    /(?::|\s-)\s*Earnings Report\s+Q/i.test(title) ||
    /\bQ[1-4\?]\s+earnings report$/i.test(title)
  ) {
    return canonicalizeGroundRuleTitle(c, title);
  }
  if (
    /^Earnings Report\s+Q/i.test(headline) ||
    /(?::|\s-)\s*Earnings Report\s+Q/i.test(headline) ||
    /\bQ[1-4\?]\s+earnings report$/i.test(headline)
  ) {
    return canonicalizeGroundRuleTitle(c, headline);
  }

  const quarter = earningsQuarterLabel(
    null,
    earningsDateForQuarterInference({
      summary: c.summary,
      timestamp: c.timestamp,
    }),
  );
  return formatEarningsReportTitle(
    quarter,
    tapeSubject(c) ?? c.companyName ?? c.symbol,
  );
}

/**
 * Legacy Form 4 rows → ground-rule `{Company} - Form 4 Insider Buy/Sell`.
 */
function form4DisplayTitle(c: FeedCatalyst): string | null {
  const isForm4 =
    c.eventCategory === "insider" ||
    c.subcategory === "insider_buy" ||
    c.subcategory === "insider_sell" ||
    c.subcategory === "form4_mixed" ||
    c.subcategory === "form4" ||
    /^(?:4(?:\/|$)|form\s*4)/i.test(c.type ?? "");
  if (!isForm4) return null;

  const title = normalizeDisplayText(c.title ?? "");
  if (/Form 4 Insider\b/i.test(title)) {
    return canonicalizeGroundRuleTitle(c, title);
  }

  const kind = form4TitleKindFromSubcategory(c.subcategory);
  // Only rewrite when we know buy/sell/mixed, or the stored title is generic.
  if (
    kind === "transaction" &&
    title &&
    !isGenericEventHeadline(title) &&
    !/(?:form\s*4|insider).*(?:filing|transaction)/i.test(title)
  ) {
    return null;
  }

  return formatForm4InsiderTitle(
    kind,
    tapeSubject(c) ?? c.companyName ?? c.symbol,
  );
}

/**
 * 8-K item rows → `{Company} - {Event}` (legacy sentence-case /
 * filing chrome / taxonomy chips).
 */
function sec8kDisplayTitle(c: FeedCatalyst): string | null {
  const is8k =
    c.sourceProvider === "sec-edgar" &&
    (/(?:8-?K|8k)/i.test(c.type ?? "") || c.subcategory === "8k");
  if (!is8k) return null;
  if (c.items.some((i) => i.code === "2.02")) return null;
  if (c.eventCategory === "earnings") return null;

  const subject = tapeSubject(c) ?? c.companyName ?? c.symbol;
  const primary =
    selectPrimaryItem(c.items) ??
    c.items.find((i) => {
      const h = normalizeDisplayText(c.headline ?? "").toLowerCase();
      return h && i.label.toLowerCase() === h;
    }) ??
    null;

  if (primary?.label && !/^earnings\s*\/\s*results$/i.test(primary.label)) {
    return formatSec8kItemTitle(primary.label, subject, {
      content: officerChangeContent(c),
    });
  }

  const headline = normalizeDisplayText(c.headline ?? "");
  if (headline && isSecCatalogHeadline(headline)) {
    return formatSec8kItemTitle(headline, subject, {
      content: officerChangeContent(c),
    });
  }

  // Bare "… 8-K filing" / "Filing" / empty reason → Current Report (or Item blurb).
  const title = normalizeDisplayText(c.title ?? "");
  if (
    !headline ||
    isGenericBare8kHeadline(headline) ||
    /(?:8-?K).*filing$/i.test(title)
  ) {
    const blurb =
      extractSecItemBlurb(c.summary, null, 110) ||
      extractSecItemBlurb(c.summary, c.items[0]?.code ?? null, 110);
    if (blurb && subject) {
      return `${subject} - ${blurb}`;
    }
    return formatSec8kItemTitle("Current report", subject);
  }

  return null;
}

function isGenericBare8kHeadline(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim().toLowerCase();
  return (
    !t ||
    t === "filing" ||
    t === "8-k filing" ||
    t === "8k filing" ||
    t === "current report" ||
    /^(?:form\s*)?8-?k(?:\s*filing)?$/i.test(t)
  );
}

/** S-3 / 424B / 425 / 13D / 13G → ground-rule offering / ownership titles. */
function secOfferingOwnershipDisplayTitle(c: FeedCatalyst): string | null {
  const subject = tapeSubject(c) ?? c.companyName ?? c.symbol;
  const sub = c.subcategory?.trim().toLowerCase() ?? "";
  const form = (c.type ?? "").trim().toUpperCase();
  const title = normalizeDisplayText(c.title ?? "");
  const headline = normalizeDisplayText(c.headline ?? "").toLowerCase();

  const isS3 =
    sub === "s3" ||
    form.startsWith("S-3") ||
    /shelf registration \(s-3\)/i.test(headline) ||
    /shelf registration \(s-3\)/i.test(title);
  if (isS3) {
    if (
      /^Shelf Registration \(S-3\)\s*-/i.test(title) ||
      /(?::|\s-)\s*Shelf Registration \(S-3\)$/i.test(title)
    ) {
      return formatShelfRegistrationTitle(subject);
    }
    return formatShelfRegistrationTitle(subject);
  }

  const is424 =
    sub === "424b" ||
    form.startsWith("424B") ||
    /prospectus \/ offering \(424b\)/i.test(headline) ||
    /prospectus \/ offering \(424b\)/i.test(title) ||
    /New Stock Offering Filed/i.test(title);
  if (is424) {
    const looksStructured =
      /structured note|pricing supplement/i.test(title) ||
      /structured note|pricing supplement/i.test(headline) ||
      c.keyFacts.some((f) => /structured note/i.test(`${f.label} ${f.value}`));
    if (looksStructured) {
      return stripSourceNames(title) || title;
    }
    return formatProspectusOfferingTitle(subject);
  }

  const is425 =
    sub === "425" ||
    form === "425" ||
    form.startsWith("425/") ||
    /merger \/ acquisition \(425\)/i.test(headline) ||
    /Merger or Acquisition News/i.test(title) ||
    /\bAnnounces Acquisition\s*[—–-]\s*Deal in Play/i.test(title);
  if (is425) {
    return format425MergerTitle(subject);
  }

  const is13d =
    sub === "13d" ||
    form.includes("13D") ||
    /(?:beneficial ownership|schedule)\s*\(?13d\)?/i.test(headline) ||
    /(?:beneficial ownership|schedule)\s*\(?13d\)?/i.test(title);
  if (is13d && !form.includes("13G")) {
    return formatSchedule13DTitle(subject);
  }

  const is13g =
    sub === "13g" ||
    form.includes("13G") ||
    /(?:beneficial ownership|schedule)\s*\(?13g\)?/i.test(headline) ||
    /(?:beneficial ownership|schedule)\s*\(?13g\)?/i.test(title);
  if (is13g) {
    return formatSchedule13GTitle(subject);
  }

  return null;
}

/** Clinical rows → subject voice; keep specific study headlines/titles when present. */
function clinicalDisplayTitle(c: FeedCatalyst): string | null {
  const isClinical =
    c.sourceProvider === "clinicaltrials" ||
    c.eventCategory === "clinical" ||
    /^clinical\s*trial/i.test(c.type ?? "");
  if (!isClinical) return null;

  const headline = normalizeDisplayText(c.headline ?? "");
  if (
    headline &&
    !looksLikeSourceLabel(headline) &&
    !isGenericEventHeadline(headline) &&
    !CLINICAL_STATUS_HEADLINES.has(headline.toLowerCase()) &&
    !/\bclinical trial update$/i.test(headline)
  ) {
    return null;
  }

  const title = normalizeDisplayText(c.title ?? "");
  if (
    title &&
    !looksLikeSourceLabel(title) &&
    !isGenericEventHeadline(title) &&
    !CLINICAL_STATUS_HEADLINES.has(title.toLowerCase()) &&
    !/\bclinical trial(?: update)?$/i.test(title) &&
    !/(?:Clinical Trial).*filing$/i.test(title)
  ) {
    return stripSourceNames(title) || title;
  }

  return formatClinicalTrialTitle(tapeSubject(c) ?? c.companyName ?? c.symbol);
}

/** Macro calendar → CPI / Jobs Report (NFP) / FOMC Rate Decision. */
function macroDisplayTitle(c: FeedCatalyst): string | null {
  const isMacro =
    c.sourceProvider === "macro-calendar" ||
    c.sourceProvider === "fmp-econ-calendar" ||
    c.eventCategory === "macro";
  if (!isMacro) return null;

  const title = normalizeDisplayText(c.title ?? "");
  const sub = c.subcategory?.trim().toLowerCase() ?? "";

  if (sub === "cpi" || /^CPI\b/i.test(title)) {
    const month = title.match(/^CPI\s*[—–-]\s*(.+)$/i)?.[1] ?? null;
    return formatCpiTitle(month);
  }

  if (sub === "nfp" || /NFP|Employment Situation|Jobs Report/i.test(title)) {
    const month =
      title.match(
        /(?:Jobs Report \(NFP\)|NFP\s*\/\s*Employment Situation)\s*[—–-]\s*(.+)$/i,
      )?.[1] ?? null;
    return formatJobsReportTitle(month);
  }

  if (sub === "fomc" || /FOMC/i.test(title)) {
    return formatFomcRateDecisionTitle();
  }

  return canonicalizeGroundRuleTitle(c, title) || null;
}

/**
 * Seeking Alpha rows → trader-facing `{Company} - {takeaway}` (display rewrite
 * so legacy Finnhub/Polygon rows update without re-ingest).
 */
function seekingAlphaDisplayTitle(c: FeedCatalyst): string | null {
  if (
    !isSeekingAlphaCatalyst({
      headline: c.headline,
      sourceUrl: c.sourceUrl,
      title: c.title,
    })
  ) {
    return null;
  }

  return formatSeekingAlphaTitle({
    title: c.title,
    summary: c.summary,
    companyName: tapeSubject(c) ?? c.companyName,
    symbol: c.symbol,
    eventCategory: c.eventCategory,
    subcategory: c.subcategory,
  });
}

/** Analyst / price-target chips → ground-rule titles. */
function analystDisplayTitle(c: FeedCatalyst): string | null {
  const isAnalyst =
    c.eventCategory === "analyst" ||
    c.subcategory === "price_target" ||
    c.subcategory === "recommendation_trend" ||
    c.subcategory === "analyst_rating" ||
    c.subcategory === "upgrade" ||
    c.subcategory === "downgrade" ||
    /^analyst/i.test(c.type ?? "");
  if (!isAnalyst) return null;

  const subject = tapeSubject(c) ?? c.companyName ?? c.symbol;
  const title = normalizeDisplayText(c.title ?? "");
  const headline = normalizeDisplayText(c.headline ?? "");
  const headlineLower = headline.toLowerCase();
  const sub = c.subcategory?.trim().toLowerCase() ?? "";

  // Keep real Street/wire story headlines; only rewrite taxonomy chips.
  if (
    headline &&
    !looksLikeSourceLabel(headline) &&
    !isGenericEventHeadline(headline)
  ) {
    return null;
  }

  if (
    sub === "price_target" ||
    /price target/i.test(headlineLower) ||
    /price target/i.test(title)
  ) {
    return formatPriceTargetTitle(subject);
  }

  if (
    sub === "recommendation_trend" ||
    sub === "analyst_rating" ||
    sub === "upgrade" ||
    sub === "downgrade" ||
    /analyst rating/i.test(headlineLower) ||
    /recommendation trend/i.test(title)
  ) {
    return formatAnalystRatingTitle(subject);
  }

  return null;
}

export function titleLine(
  c: FeedCatalyst,
  options: TitleLineOptions = {},
): string {
  const maxBlurbChars = options.maxBlurbChars ?? 110;
  const headline = normalizeDisplayText(c.headline ?? "");
  const title = normalizeDisplayText(c.title ?? "");
  const subject = tapeSubject(c);

  const seekingAlphaTitle = seekingAlphaDisplayTitle(c);
  if (seekingAlphaTitle) return seekingAlphaTitle;

  if (prefersStoredGroundRuleTitle(c, title)) {
    const canonical = canonicalizeGroundRuleTitle(c, title);
    return stripSourceNames(canonical) || canonical;
  }

  const earningsTitle = earningsReportDisplayTitle(c);
  if (earningsTitle) return earningsTitle;

  const form4Title = form4DisplayTitle(c);
  if (form4Title) return form4Title;

  const offeringTitle = secOfferingOwnershipDisplayTitle(c);
  if (offeringTitle) return offeringTitle;

  const clinicalTitle = clinicalDisplayTitle(c);
  if (clinicalTitle) return clinicalTitle;

  const macroTitle = macroDisplayTitle(c);
  if (macroTitle) return macroTitle;

  const analystTitle = analystDisplayTitle(c);
  if (analystTitle) return analystTitle;

  const sec8kTitle = sec8kDisplayTitle(c);
  if (sec8kTitle) return sec8kTitle;

  // Real news / wire copy wins when it is not a publisher, status, or chip.
  if (
    headline &&
    !looksLikeSourceLabel(headline) &&
    !isGenericEventHeadline(headline) &&
    !CLINICAL_STATUS_HEADLINES.has(headline.toLowerCase())
  ) {
    return stripSourceNames(headline) || headline;
  }

  // Generic SEC / calendar event — prefer ground-rule `{Company} - {Event}`.
  if (headline && isGenericEventHeadline(headline)) {
    if (isSecCatalogHeadline(headline) && subject) {
      if (!/^earnings\s*\/\s*results$/i.test(headline)) {
        return formatSec8kItemTitle(headline, subject, {
          content: officerChangeContent(c),
        });
      }
    }
    if (/shelf registration \(s-3\)/i.test(headline) && subject) {
      return formatShelfRegistrationTitle(subject);
    }
    if (/prospectus \/ offering \(424b\)/i.test(headline) && subject) {
      return formatProspectusOfferingTitle(subject);
    }
    if (/merger \/ acquisition \(425\)/i.test(headline) && subject) {
      return format425MergerTitle(subject);
    }
    if (/(?:beneficial ownership|schedule)\s*\(?13d\)?/i.test(headline)) {
      return formatSchedule13DTitle(subject);
    }
    if (/(?:beneficial ownership|schedule)\s*\(?13g\)?/i.test(headline)) {
      return formatSchedule13GTitle(subject);
    }
    if (/price target/i.test(headline) && subject) {
      return formatPriceTargetTitle(subject);
    }
    if (/analyst rating/i.test(headline) && subject) {
      return formatAnalystRatingTitle(subject);
    }

    const primaryCode =
      c.items.find((i) => i.label.toLowerCase() === headline.toLowerCase())
        ?.code ??
      c.items[0]?.code ??
      null;
    const blurb =
      extractSecItemBlurb(c.summary, primaryCode, maxBlurbChars) ||
      titleCaseEventLabel(stripSourceNames(headline) || headline) ||
      headline;
    if (subject) {
      // Avoid "ACME — ACME — Earnings…" when blurb somehow repeats subject.
      if (blurb.toLowerCase().startsWith(subject.toLowerCase())) {
        return blurb;
      }
      return `${subject} — ${blurb}`;
    }
    return blurb;
  }

  let raw = "";
  if (
    headline &&
    !looksLikeSourceLabel(headline) &&
    !CLINICAL_STATUS_HEADLINES.has(headline.toLowerCase())
  ) {
    raw = headline;
  } else if (title) {
    raw = title;
  } else if (headline) {
    raw = headline;
  } else {
    raw = c.type;
  }

  const cleaned = stripSourceNames(raw);
  if ((!cleaned || looksLikeSourceLabel(cleaned)) && title && title !== raw) {
    const fromTitle = stripSourceNames(title);
    if (fromTitle && !looksLikeSourceLabel(fromTitle)) return fromTitle;
  }

  // Catalog label alone (after source strip) → ground-rule with company.
  if (cleaned && isSecCatalogHeadline(cleaned) && subject) {
    if (!/^earnings\s*\/\s*results$/i.test(cleaned)) {
      return formatSec8kItemTitle(cleaned, subject, {
        content: officerChangeContent(c),
      });
    }
  }

  // Filing title "ACME — 8-K filing" with no usable headline: prefer ground-rule.
  if (
    cleaned &&
    subject &&
    /(?:8-?K|Form\s*4|S-3|424B|425|SC\s*13).*filing$/i.test(cleaned)
  ) {
    const primary = selectPrimaryItem(c.items) ?? c.items[0] ?? null;
    if (primary?.label) {
      return formatSec8kItemTitle(primary.label, subject, {
        content: officerChangeContent(c),
      });
    }
    const event =
      (primary &&
        extractSecItemBlurb(c.summary, primary.code, maxBlurbChars)) ||
      extractSecItemBlurb(c.summary, null, maxBlurbChars) ||
      null;
    if (event) return `${subject} - ${event}`;
    if (/(?:8-?K).*filing$/i.test(cleaned)) {
      return formatSec8kItemTitle("Current report", subject);
    }
    return cleaned;
  }

  if (cleaned && !looksLikeSourceLabel(cleaned)) return cleaned;
  if (title && !looksLikeSourceLabel(title))
    return stripSourceNames(title) || title;
  return cleaned || title || c.type;
}

/** Full filing blurb for hover — same composition as {@link titleLine}, less cut. */
export function titleTooltipLine(c: FeedCatalyst): string {
  return titleLine(c, { maxBlurbChars: 480 });
}

/**
 * Live-tape search: match symbol, company name, filing title, and the
 * displayed title line (headline-first) case-insensitively.
 */
export function matchesFeedSearchQuery(
  c: FeedCatalyst,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const fields = [c.symbol, c.companyName, c.title, c.headline, titleLine(c)];
  return fields.some((field) => (field ?? "").toLowerCase().includes(q));
}

/** Human-readable Event cell labels for known subcategories. */
const SUBCATEGORY_LABELS: Record<string, string> = {
  insider_buy: "Insider buy",
  insider_sell: "Insider sell",
  form4_mixed: "Mixed Form 4",
  form4: "Form 4",
  upgrade: "Upgrade",
  downgrade: "Downgrade",
  price_target: "Price target",
  analyst_rating: "Analyst rating",
  recommendation_trend: "Recommendation trend",
  ipo: "IPO",
  ipo_priced: "IPO priced",
  ipo_filed: "IPO filed",
  ipo_withdrawn: "IPO withdrawn",
  ipo_news: "IPO news",
  benzinga_wire: "Press release",
  press_release: "Press release",
  fda_approval: "FDA approval",
  openfda_approval: "FDA approval",
  halt_resumed: "Halt resumed",
  halt: "Trading halt",
  bmo: "Before market open",
  amc: "After market close",
};

/** Event cell: subcategory when present, else type / category. */
export function eventLabel(c: FeedCatalyst): string {
  const sub = c.subcategory?.trim();
  if (sub && SUBCATEGORY_LABELS[sub]) return SUBCATEGORY_LABELS[sub];

  // 8-K rows: show the Item reason (or category), never bare "8k" / "8-K".
  const is8k =
    sub === "8k" ||
    /(?:8-?K|8k)/i.test(c.type ?? "") ||
    (c.sourceProvider === "sec-edgar" && sub === "8k");
  if (is8k || sub === "8k") {
    const primary = selectPrimaryItem(c.items);
    if (primary?.label) {
      return titleCaseEventLabel(primary.label) || primary.label;
    }
    const headline = normalizeDisplayText(c.headline ?? "");
    if (headline && !isGenericBare8kHeadline(headline)) {
      if (isSecCatalogHeadline(headline)) {
        return titleCaseEventLabel(headline) || headline;
      }
      return headline;
    }
    if (c.eventCategory && c.eventCategory in CATEGORY_LABELS) {
      return CATEGORY_LABELS[c.eventCategory as EventCategoryKey];
    }
    return "Current report";
  }

  if (sub) return sub.replace(/_/g, " ");
  if (c.type?.trim()) return c.type.trim();
  if (c.eventCategory && c.eventCategory in CATEGORY_LABELS) {
    return CATEGORY_LABELS[c.eventCategory as EventCategoryKey];
  }
  return "—";
}

/** Stable style key for sector pills (category when known, else generic). */
export function sectorTone(
  c: FeedCatalyst,
): EventCategoryKey | "sector" | "sec" {
  if (c.eventCategory) return c.eventCategory;
  if (c.sector?.trim()) return "sector";
  if (c.sourceProvider === "sec-edgar" || /^8-?K$/i.test(c.type)) return "sec";
  return "other";
}
