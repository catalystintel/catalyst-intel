/**
 * Structured detail cards for the in-app article reader.
 * Earnings is first-class; other categories expose structured raw fields when present.
 */

import { isEventCategoryKey } from "@/lib/catalysts/taxonomy";

export type DetailTone = "positive" | "negative" | "neutral" | "muted";

export type DetailCardKind = "earnings" | "halt" | "fda" | "generic";

export interface DetailField {
  label: string;
  value: string;
  tone?: DetailTone;
}

export interface ArticleDetailCard {
  id: string;
  kind: DetailCardKind;
  title: string;
  /** Plain-language lead so traders understand the event at a glance. */
  intro?: string | null;
  fields: DetailField[];
}

export type BeatMiss = "beat" | "miss" | "inline";

export interface EarningsFigures {
  date?: string | null;
  period?: string | null;
  quarter?: number | null;
  year?: number | null;
  hour?: string | null;
  epsActual?: number | null;
  epsEstimate?: number | null;
  epsSurprise?: number | null;
  epsSurprisePct?: number | null;
  revenueActual?: number | null;
  revenueEstimate?: number | null;
  revenueSurprise?: number | null;
  revenueSurprisePct?: number | null;
  epsBeatMiss?: BeatMiss | null;
  revenueBeatMiss?: BeatMiss | null;
  guidance?: string | null;
  /** Where the figures came from after merge. */
  source: "raw" | "enriched" | "merged";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringField(
  record: Record<string, unknown> | null,
  ...keys: string[]
): string | null {
  if (!record) return null;
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function numberField(
  record: Record<string, unknown> | null,
  ...keys: string[]
): number | null {
  if (!record) return null;
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function formatNumber(
  value: number | null | undefined,
  digits = 2,
): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(digits, 2),
  });
}

function formatCompactCurrency(
  value: number | null | undefined,
): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${formatNumber(value, 2)}`;
}

function formatPct(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value, 2)}%`;
}

function beatMissFrom(
  actual: number | null | undefined,
  estimate: number | null | undefined,
  surprisePct?: number | null,
): BeatMiss | null {
  if (surprisePct != null && Number.isFinite(surprisePct)) {
    if (Math.abs(surprisePct) < 0.05) return "inline";
    return surprisePct > 0 ? "beat" : "miss";
  }
  if (
    actual == null ||
    estimate == null ||
    !Number.isFinite(actual) ||
    !Number.isFinite(estimate)
  ) {
    return null;
  }
  const delta = actual - estimate;
  if (Math.abs(delta) < 1e-9) return "inline";
  return delta > 0 ? "beat" : "miss";
}

function surprisePctFrom(
  actual: number | null | undefined,
  estimate: number | null | undefined,
  explicit?: number | null,
): number | null {
  if (explicit != null && Number.isFinite(explicit)) return explicit;
  if (
    actual == null ||
    estimate == null ||
    !Number.isFinite(actual) ||
    !Number.isFinite(estimate) ||
    estimate === 0
  ) {
    return null;
  }
  return ((actual - estimate) / Math.abs(estimate)) * 100;
}

function toneForBeatMiss(flag: BeatMiss | null | undefined): DetailTone {
  if (flag === "beat") return "positive";
  if (flag === "miss") return "negative";
  if (flag === "inline") return "neutral";
  return "muted";
}

function labelBeatMiss(flag: BeatMiss | null | undefined): string | null {
  if (flag === "beat") return "Beat";
  if (flag === "miss") return "Miss";
  if (flag === "inline") return "In line";
  return null;
}

function periodLabel(
  figures: Pick<EarningsFigures, "quarter" | "year" | "period" | "date">,
): string | null {
  if (figures.period?.trim()) return figures.period.trim();
  if (figures.quarter != null && figures.year != null) {
    return `Q${figures.quarter} ${figures.year}`;
  }
  if (figures.quarter != null) return `Q${figures.quarter}`;
  if (figures.year != null) return String(figures.year);
  if (figures.date?.trim()) return figures.date.trim();
  return null;
}

function hourLabel(hour?: string | null): string | null {
  const h = hour?.trim().toLowerCase();
  if (!h || h === "unknown") return null;
  if (h === "bmo") return "Before market open";
  if (h === "amc") return "After market close";
  return hour!.trim();
}

/**
 * Detect earnings catalysts from category / subcategory / type / provider tags.
 */
export function isEarningsCatalyst(input: {
  eventCategory?: string | null;
  subcategory?: string | null;
  type?: string | null;
  headline?: string | null;
  title?: string | null;
  provider?: string | null;
  tags?: string[] | null;
  itemCodes?: Array<{ code?: string | null; label?: string | null }> | null;
}): boolean {
  if (input.eventCategory === "earnings") return true;

  const sub = input.subcategory?.toLowerCase() ?? "";
  if (
    sub.includes("earnings") ||
    sub === "bmo" ||
    sub === "amc" ||
    sub === "earnings_calendar"
  ) {
    return true;
  }

  const type = input.type?.toLowerCase() ?? "";
  if (type.includes("earnings")) return true;

  const headline = input.headline?.toLowerCase() ?? "";
  const title = input.title?.toLowerCase() ?? "";
  if (headline.includes("earnings") || title.includes("earnings")) return true;

  if (
    Array.isArray(input.tags) &&
    input.tags.some((t) => t.toLowerCase() === "earnings")
  ) {
    return true;
  }

  if (
    Array.isArray(input.itemCodes) &&
    input.itemCodes.some(
      (item) =>
        item.code === "2.02" ||
        /earnings|results of operations/i.test(item.label ?? ""),
    )
  ) {
    return true;
  }

  // Finnhub earnings calendar payload shape.
  const provider = input.provider?.trim();
  if (provider === "finnhub" && input.eventCategory === "earnings") return true;

  return false;
}

/**
 * Pull Finnhub-style earnings figures from a single raw_content object
 * (or nested calendar row).
 */
export function parseEarningsFromRaw(
  rawContent: unknown,
): EarningsFigures | null {
  const root = asRecord(rawContent);
  if (!root) return null;

  // Wrapped calendar payloads: { earningsCalendar: [row] } or { data: row }
  let raw = root;
  if (Array.isArray(root.earningsCalendar) && root.earningsCalendar[0]) {
    const first = asRecord(root.earningsCalendar[0]);
    if (first) raw = first;
  } else if (asRecord(root.data)) {
    raw = asRecord(root.data)!;
  }

  const epsActual = numberField(
    raw,
    "epsActual",
    "eps_actual",
    "actualEps",
    "actual",
  );
  const epsEstimate = numberField(
    raw,
    "epsEstimate",
    "eps_estimate",
    "estimateEps",
    "estimate",
  );
  // Finnhub /stock/earnings uses actual/estimate for EPS; avoid treating those
  // as revenue. Prefer explicit revenue keys.
  const revenueActual = numberField(
    raw,
    "revenueActual",
    "revenue_actual",
    "actualRevenue",
    "revenue",
  );
  const revenueEstimate = numberField(
    raw,
    "revenueEstimate",
    "revenue_estimate",
    "estimateRevenue",
  );

  const epsSurprise = numberField(
    raw,
    "epsSurprise",
    "surprise",
    "surpriseEps",
  );
  const epsSurprisePct = surprisePctFrom(
    epsActual,
    epsEstimate,
    numberField(raw, "epsSurprisePercent", "surprisePercent", "surprisePct"),
  );
  const revenueSurprisePct = surprisePctFrom(
    revenueActual,
    revenueEstimate,
    numberField(raw, "revenueSurprisePercent", "revenueSurprisePct"),
  );

  const quarter = numberField(raw, "quarter", "q");
  const year = numberField(raw, "year", "fiscalYear");
  const date = stringField(raw, "date", "period", "reportDate");
  const period =
    stringField(raw, "periodLabel", "fiscalPeriod") ||
    (quarter != null || year != null ? null : stringField(raw, "period"));
  const hour = stringField(raw, "hour", "when");
  const guidance = stringField(
    raw,
    "guidance",
    "guidanceNote",
    "guidanceNotes",
    "outlook",
  );

  const hasAny =
    epsActual != null ||
    epsEstimate != null ||
    revenueActual != null ||
    revenueEstimate != null ||
    quarter != null ||
    year != null ||
    Boolean(date) ||
    Boolean(guidance);

  if (!hasAny) return null;

  // When raw uses Finnhub /stock/earnings shape (actual/estimate + surprisePercent)
  // and we already mapped actual→epsActual, don't also treat period string as date
  // if it looks like YYYY-MM-DD end-of-quarter.
  const figures: EarningsFigures = {
    date,
    period:
      period ||
      (quarter != null && year != null ? `Q${quarter} ${year}` : null),
    quarter,
    year,
    hour,
    epsActual,
    epsEstimate,
    epsSurprise,
    epsSurprisePct,
    revenueActual,
    revenueEstimate,
    revenueSurprise: numberField(raw, "revenueSurprise"),
    revenueSurprisePct,
    epsBeatMiss: beatMissFrom(epsActual, epsEstimate, epsSurprisePct),
    revenueBeatMiss: beatMissFrom(
      revenueActual,
      revenueEstimate,
      revenueSurprisePct,
    ),
    guidance,
    source: "raw",
  };

  return figures;
}

/** Prefer non-null fields from preferred over base. */
export function mergeEarningsFigures(
  base: EarningsFigures | null,
  preferred: EarningsFigures | null,
): EarningsFigures | null {
  if (!base && !preferred) return null;
  if (!base)
    return preferred ? { ...preferred, source: preferred.source } : null;
  if (!preferred) return base;

  const pick = <T>(
    a: T | null | undefined,
    b: T | null | undefined,
  ): T | null =>
    (a != null && a !== "" ? a : null) ??
    (b != null && b !== "" ? b : null) ??
    null;

  const merged: EarningsFigures = {
    date: pick(base.date, preferred.date),
    period: pick(base.period, preferred.period),
    quarter: pick(base.quarter, preferred.quarter),
    year: pick(base.year, preferred.year),
    hour: pick(base.hour, preferred.hour),
    epsActual: pick(base.epsActual, preferred.epsActual),
    epsEstimate: pick(base.epsEstimate, preferred.epsEstimate),
    epsSurprise: pick(base.epsSurprise, preferred.epsSurprise),
    epsSurprisePct: pick(base.epsSurprisePct, preferred.epsSurprisePct),
    revenueActual: pick(base.revenueActual, preferred.revenueActual),
    revenueEstimate: pick(base.revenueEstimate, preferred.revenueEstimate),
    revenueSurprise: pick(base.revenueSurprise, preferred.revenueSurprise),
    revenueSurprisePct: pick(
      base.revenueSurprisePct,
      preferred.revenueSurprisePct,
    ),
    guidance: pick(base.guidance, preferred.guidance),
    source: "merged",
    epsBeatMiss: null,
    revenueBeatMiss: null,
  };

  merged.epsSurprisePct = surprisePctFrom(
    merged.epsActual,
    merged.epsEstimate,
    merged.epsSurprisePct,
  );
  merged.revenueSurprisePct = surprisePctFrom(
    merged.revenueActual,
    merged.revenueEstimate,
    merged.revenueSurprisePct,
  );
  merged.epsBeatMiss = beatMissFrom(
    merged.epsActual,
    merged.epsEstimate,
    merged.epsSurprisePct,
  );
  merged.revenueBeatMiss = beatMissFrom(
    merged.revenueActual,
    merged.revenueEstimate,
    merged.revenueSurprisePct,
  );

  return merged;
}

export function buildEarningsIntro(
  figures: EarningsFigures,
  input?: { symbol?: string | null; companyName?: string | null },
): string {
  const symbol = input?.symbol?.trim().toUpperCase() || null;
  const company = input?.companyName?.trim() || null;
  const subject =
    symbol && company && company.toUpperCase() !== symbol
      ? `${company} (${symbol})`
      : symbol || company || "This issuer";

  const period = periodLabel(figures);
  const periodBit = period ? ` for ${period}` : "";

  const epsFlag = labelBeatMiss(figures.epsBeatMiss);
  const revFlag = labelBeatMiss(figures.revenueBeatMiss);

  if (figures.epsActual != null && figures.epsEstimate != null && epsFlag) {
    const surprise = formatPct(figures.epsSurprisePct);
    const surpriseBit = surprise ? ` (${surprise} surprise)` : "";
    return `${subject} reported earnings${periodBit}: EPS ${epsFlag.toLowerCase()}${surpriseBit} — actual ${formatNumber(figures.epsActual)} vs estimate ${formatNumber(figures.epsEstimate)}.`;
  }

  if (figures.epsActual != null) {
    return `${subject} reported earnings${periodBit} with actual EPS of ${formatNumber(figures.epsActual)}.`;
  }

  if (figures.epsEstimate != null) {
    const when = hourLabel(figures.hour);
    const whenBit = when ? ` ${when.toLowerCase()}` : "";
    return `${subject} has a scheduled earnings report${periodBit}${whenBit}. Consensus EPS estimate is ${formatNumber(figures.epsEstimate)}.`;
  }

  if (revFlag && figures.revenueActual != null) {
    return `${subject} reported earnings${periodBit}: revenue ${revFlag.toLowerCase()} at ${formatCompactCurrency(figures.revenueActual)}.`;
  }

  return `${subject} has an earnings catalyst${periodBit}. Figures below show estimate and actual results when available.`;
}

export function earningsFiguresToCard(
  figures: EarningsFigures,
  input?: { symbol?: string | null; companyName?: string | null },
): ArticleDetailCard {
  const fields: DetailField[] = [];
  const period = periodLabel(figures);
  if (period) fields.push({ label: "Period", value: period });
  if (figures.date && figures.date !== period) {
    fields.push({ label: "Report date", value: figures.date });
  }
  const when = hourLabel(figures.hour);
  if (when) fields.push({ label: "Timing", value: when });

  if (figures.epsActual != null) {
    fields.push({
      label: "EPS actual",
      value: formatNumber(figures.epsActual)!,
      tone: toneForBeatMiss(figures.epsBeatMiss),
    });
  }
  if (figures.epsEstimate != null) {
    fields.push({
      label: "EPS estimate",
      value: formatNumber(figures.epsEstimate)!,
    });
  }
  if (figures.epsSurprisePct != null) {
    fields.push({
      label: "EPS surprise",
      value: formatPct(figures.epsSurprisePct)!,
      tone: toneForBeatMiss(figures.epsBeatMiss),
    });
  } else if (figures.epsBeatMiss) {
    fields.push({
      label: "EPS vs estimate",
      value: labelBeatMiss(figures.epsBeatMiss)!,
      tone: toneForBeatMiss(figures.epsBeatMiss),
    });
  }

  if (figures.revenueActual != null) {
    fields.push({
      label: "Revenue actual",
      value: formatCompactCurrency(figures.revenueActual)!,
      tone: toneForBeatMiss(figures.revenueBeatMiss),
    });
  }
  if (figures.revenueEstimate != null) {
    fields.push({
      label: "Revenue estimate",
      value: formatCompactCurrency(figures.revenueEstimate)!,
    });
  }
  if (figures.revenueSurprisePct != null) {
    fields.push({
      label: "Revenue surprise",
      value: formatPct(figures.revenueSurprisePct)!,
      tone: toneForBeatMiss(figures.revenueBeatMiss),
    });
  } else if (figures.revenueBeatMiss) {
    fields.push({
      label: "Revenue vs estimate",
      value: labelBeatMiss(figures.revenueBeatMiss)!,
      tone: toneForBeatMiss(figures.revenueBeatMiss),
    });
  }

  if (figures.guidance) {
    fields.push({ label: "Guidance", value: figures.guidance });
  }

  return {
    id: "earnings-results",
    kind: "earnings",
    title: "Earnings results",
    intro: buildEarningsIntro(figures, input),
    fields,
  };
}

function haltDetailCard(rawContent: unknown): ArticleDetailCard | null {
  const raw = asRecord(rawContent);
  if (!raw) return null;
  const fields: DetailField[] = [];
  const reason = stringField(raw, "reasonCode", "reason", "haltReason");
  const description = stringField(raw, "description", "summary");
  const resumption = stringField(
    raw,
    "resumptionTime",
    "resumptionDateTime",
    "resumeTime",
  );
  const haltTime = stringField(raw, "haltTime", "haltDateTime", "issueTime");
  const market = stringField(raw, "market", "exchange");

  if (reason) fields.push({ label: "Reason", value: reason });
  if (description && description !== reason) {
    fields.push({ label: "Detail", value: description });
  }
  if (haltTime) fields.push({ label: "Halt time", value: haltTime });
  if (resumption) fields.push({ label: "Resumption", value: resumption });
  if (market) fields.push({ label: "Market", value: market });

  if (fields.length === 0) return null;

  const intro = resumption
    ? `Trading halt update with planned or recorded resumption at ${resumption}.`
    : reason
      ? `Exchange trading halt — reason code ${reason}.`
      : "Exchange trading-halt event details from the venue feed.";

  return {
    id: "halt-detail",
    kind: "halt",
    title: "Halt details",
    intro,
    fields,
  };
}

function fdaDetailCard(rawContent: unknown): ArticleDetailCard | null {
  const raw = asRecord(rawContent);
  if (!raw) return null;
  const fields: DetailField[] = [];

  const drug = stringField(raw, "drug", "brand_name", "brandName");
  const indication = stringField(raw, "indication");
  const status = stringField(raw, "status", "submission_status");
  const catalyst = stringField(raw, "catalyst");
  const designation = stringField(
    raw,
    "designation",
    "submission_class_code_description",
    "submission_class_code",
  );
  const sponsor = stringField(raw, "sponsor_name", "company", "sponsor");

  // openFDA nested submissions
  const submissions = Array.isArray(raw.submissions) ? raw.submissions : [];
  const firstSub = asRecord(submissions[0] ?? null);
  const subType = stringField(firstSub, "submission_type");
  const subClass = stringField(
    firstSub,
    "submission_class_code_description",
    "submission_class_code",
  );

  if (sponsor) fields.push({ label: "Sponsor", value: sponsor });
  if (drug) fields.push({ label: "Drug / product", value: drug });
  if (indication) fields.push({ label: "Indication", value: indication });
  if (catalyst) fields.push({ label: "Catalyst", value: catalyst });
  if (status) fields.push({ label: "Status", value: status });
  if (designation || subClass) {
    fields.push({ label: "Designation", value: (designation || subClass)! });
  }
  if (subType) fields.push({ label: "Submission type", value: subType });

  if (fields.length === 0) return null;

  return {
    id: "fda-detail",
    kind: "fda",
    title: "Regulatory details",
    intro: drug
      ? `FDA / regulatory record for ${drug}${indication ? ` (${indication})` : ""}.`
      : "Structured FDA or regulatory calendar fields from the source payload.",
    fields,
  };
}

export interface ResolveArticleDetailsInput {
  eventCategory?: string | null;
  subcategory?: string | null;
  type?: string | null;
  headline?: string | null;
  title?: string | null;
  symbol?: string | null;
  companyName?: string | null;
  provider?: string | null;
  tags?: string[] | null;
  itemCodes?: Array<{ code?: string | null; label?: string | null }> | null;
  rawContent?: unknown;
  /** Optional Finnhub-enriched figures merged on top of raw. */
  enrichedEarnings?: EarningsFigures | null;
}

/**
 * Build zero or more structured detail cards for the article view.
 */
export function resolveArticleDetailCards(
  input: ResolveArticleDetailsInput,
): ArticleDetailCard[] {
  const cards: ArticleDetailCard[] = [];
  const category = input.eventCategory;
  const provider = input.provider?.trim() || null;

  if (isEarningsCatalyst(input)) {
    const fromRaw = parseEarningsFromRaw(input.rawContent);
    const merged = mergeEarningsFigures(
      fromRaw,
      input.enrichedEarnings ?? null,
    );
    if (
      merged &&
      (merged.epsActual != null ||
        merged.epsEstimate != null ||
        merged.revenueActual != null ||
        merged.revenueEstimate != null ||
        merged.guidance ||
        periodLabel(merged))
    ) {
      cards.push(
        earningsFiguresToCard(merged, {
          symbol: input.symbol,
          companyName: input.companyName,
        }),
      );
    } else {
      // Still show a plain-language earnings panel when we know it's earnings
      // but figures are missing (e.g. SEC 8-K Item 2.02 without numbers).
      cards.push({
        id: "earnings-results",
        kind: "earnings",
        title: "Earnings results",
        intro: `${
          input.symbol?.trim().toUpperCase() ||
          input.companyName?.trim() ||
          "This issuer"
        } has an earnings-related catalyst. Detailed EPS and revenue figures were not stored on this row — open the original filing or source for the full results release.`,
        fields: [
          ...(input.type
            ? [{ label: "Type", value: input.type } satisfies DetailField]
            : []),
          ...(category && isEventCategoryKey(category)
            ? [{ label: "Category", value: "Earnings" } satisfies DetailField]
            : []),
        ],
      });
    }
  }

  if (
    category === "trading_halt" ||
    provider === "nasdaq-halts" ||
    /halt/i.test(input.type ?? "") ||
    /halt/i.test(input.subcategory ?? "")
  ) {
    const halt = haltDetailCard(input.rawContent);
    if (halt) cards.push(halt);
  }

  if (
    category === "regulatory" ||
    category === "clinical" ||
    provider === "openfda" ||
    /fda/i.test(input.subcategory ?? "") ||
    /fda/i.test(input.type ?? "")
  ) {
    const fda = fdaDetailCard(input.rawContent);
    if (fda) cards.push(fda);
  }

  return cards;
}

/** Map Finnhub /stock/earnings row into EarningsFigures. */
export function finnhubStockEarningsToFigures(row: {
  actual?: number | null;
  estimate?: number | null;
  period?: string | null;
  quarter?: number | null;
  surprise?: number | null;
  surprisePercent?: number | null;
  symbol?: string | null;
  year?: number | null;
}): EarningsFigures {
  const epsActual =
    typeof row.actual === "number" && Number.isFinite(row.actual)
      ? row.actual
      : null;
  const epsEstimate =
    typeof row.estimate === "number" && Number.isFinite(row.estimate)
      ? row.estimate
      : null;
  const epsSurprisePct =
    typeof row.surprisePercent === "number" &&
    Number.isFinite(row.surprisePercent)
      ? row.surprisePercent
      : surprisePctFrom(epsActual, epsEstimate, null);

  return {
    date: row.period ?? null,
    period:
      row.quarter != null && row.year != null
        ? `Q${row.quarter} ${row.year}`
        : (row.period ?? null),
    quarter: row.quarter ?? null,
    year: row.year ?? null,
    hour: null,
    epsActual,
    epsEstimate,
    epsSurprise:
      typeof row.surprise === "number" && Number.isFinite(row.surprise)
        ? row.surprise
        : null,
    epsSurprisePct,
    revenueActual: null,
    revenueEstimate: null,
    revenueSurprise: null,
    revenueSurprisePct: null,
    epsBeatMiss: beatMissFrom(epsActual, epsEstimate, epsSurprisePct),
    revenueBeatMiss: null,
    guidance: null,
    source: "enriched",
  };
}
