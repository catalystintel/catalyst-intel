/**
 * EDGAR daily-index (`master.YYYYMMDD.idx`) catch-up for SEC discovery.
 * Published ~EOD — closes multi-hour/day gaps Atom pagination cannot cover.
 */

import {
  format425MergerTitle,
  formatForm4InsiderTitle,
  formatProspectusOfferingTitle,
  formatSchedule13DTitle,
  formatSchedule13GTitle,
  formatShelfRegistrationTitle,
} from "@/lib/catalysts/catalyst-titles";
import { classifySecFormType } from "@/lib/jobs/parse-8k-items";
import { accessionToFolder } from "@/lib/jobs/parse-form4";
import type { NormalizedCatalyst } from "@/lib/jobs/ingest-pipeline";
import {
  SEC_DAILY_INDEX_VENDOR_ID,
  secFormVendorSourceId,
} from "@/lib/jobs/sec-atom-pagination";

/** Configured Atom feed form prefixes we reconcile from master.idx. */
export const SEC_DAILY_INDEX_FORM_TYPES = [
  "8-K",
  "4",
  "S-3",
  "424B",
  "425",
  "SC 13D",
  "SC 13G",
] as const;

export type SecDailyIndexRow = {
  cik: number;
  companyName: string;
  formType: string;
  dateFiled: string;
  fileName: string;
  accessionNumber: string;
};

export function yyyymmddInEt(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}${m}${d}`;
}

export function addDaysYyyymmdd(yyyymmdd: string, deltaDays: number): string {
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6));
  const d = Number(yyyymmdd.slice(6, 8));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

export function quarterPathForYyyymmdd(yyyymmdd: string): {
  year: string;
  qtr: number;
} {
  const year = yyyymmdd.slice(0, 4);
  const month = Number(yyyymmdd.slice(4, 6));
  const qtr = Math.ceil(month / 3);
  return { year, qtr };
}

export function masterIdxUrl(yyyymmdd: string): string {
  const { year, qtr } = quarterPathForYyyymmdd(yyyymmdd);
  return `https://www.sec.gov/Archives/edgar/daily-index/${year}/QTR${qtr}/master.${yyyymmdd}.idx`;
}

/**
 * Whether a master.idx form type belongs to a configured feed type.
 * Form "4" must not match 424B / 14A.
 */
export function formMatchesConfiguredType(
  formType: string,
  configured: string,
): boolean {
  const f = formType.trim().toUpperCase();
  const c = configured.trim().toUpperCase();
  if (c === "8-K") return /^8-?K/i.test(f);
  if (c === "4") return /^4(\/A)?$/i.test(f);
  if (c === "S-3") return /^S-3/i.test(f);
  if (c === "424B") return /^424B/i.test(f);
  if (c === "425") return /^425(\/A)?$/i.test(f);
  if (c === "SC 13D") return /(?:SC\s*13D|SCHEDULE\s*13D)/i.test(f);
  if (c === "SC 13G") return /(?:SC\s*13G|SCHEDULE\s*13G)/i.test(f);
  return false;
}

export function formMatchesAnyConfigured(
  formType: string,
  configured: readonly string[] = SEC_DAILY_INDEX_FORM_TYPES,
): boolean {
  return configured.some((c) => formMatchesConfiguredType(formType, c));
}

export function accessionFromMasterFileName(fileName: string): string | null {
  const base = fileName.trim().split("/").pop() ?? "";
  const match = base.match(/^(\d{10}-\d{2}-\d{6})\.txt$/i);
  return match?.[1] ?? null;
}

/**
 * Parse master.idx body (pipe-delimited after the dashed header).
 */
export function parseMasterIdx(text: string): SecDailyIndexRow[] {
  const lines = text.split(/\r?\n/);
  let dataStarted = false;
  const out: SecDailyIndexRow[] = [];

  for (const line of lines) {
    if (!dataStarted) {
      if (/^-{10,}/.test(line.trim())) {
        dataStarted = true;
      }
      continue;
    }
    if (!line.trim()) continue;
    const parts = line.split("|");
    if (parts.length < 5) continue;
    const [cikRaw, companyName, formType, dateFiled, fileName] = parts;
    const cik = Number(cikRaw.trim());
    if (!Number.isFinite(cik)) continue;
    const accessionNumber = accessionFromMasterFileName(fileName);
    if (!accessionNumber) continue;
    out.push({
      cik,
      companyName: companyName.trim(),
      formType: formType.trim(),
      dateFiled: dateFiled.trim(),
      fileName: fileName.trim(),
      accessionNumber,
    });
  }
  return out;
}

export function filingDateToIso(dateFiled: string): string {
  // YYYYMMDD → noon UTC
  if (!/^\d{8}$/.test(dateFiled)) {
    return new Date().toISOString();
  }
  const y = dateFiled.slice(0, 4);
  const m = dateFiled.slice(4, 6);
  const d = dateFiled.slice(6, 8);
  return new Date(`${y}-${m}-${d}T12:00:00.000Z`).toISOString();
}

export function indexUrlForMasterRow(row: SecDailyIndexRow): string {
  const folder = accessionToFolder(row.accessionNumber);
  return `https://www.sec.gov/Archives/edgar/data/${row.cik}/${folder}/${row.accessionNumber}-index.htm`;
}

export function masterRowToNormalized(
  row: SecDailyIndexRow,
  symbolByCik: Map<number, string>,
): NormalizedCatalyst | null {
  if (!formMatchesAnyConfigured(row.formType)) return null;

  const formType = row.formType;
  const companyName = row.companyName;
  const symbol = symbolByCik.get(row.cik) ?? null;
  const formMeta = classifySecFormType(formType);

  let title = `${companyName} — ${formType} filing`;
  if (formMeta.subcategory === "form4") {
    title = formatForm4InsiderTitle("transaction", companyName);
  } else if (formMeta.subcategory === "s3") {
    title = formatShelfRegistrationTitle(companyName);
  } else if (formMeta.subcategory === "424b") {
    title = formatProspectusOfferingTitle(companyName);
  } else if (formMeta.subcategory === "425") {
    title = format425MergerTitle(companyName);
  } else if (formMeta.subcategory === "13d") {
    title = formatSchedule13DTitle(companyName);
  } else if (formMeta.subcategory === "13g") {
    title = formatSchedule13GTitle(companyName);
  } else if (/^8-?K/i.test(formType)) {
    title = `${companyName} — ${formType} filing`;
  }

  const link = indexUrlForMasterRow(row);
  const timestamp = filingDateToIso(row.dateFiled);
  const summary = `SEC ${formType} filed ${row.dateFiled} (daily-index catch-up).`;

  return {
    provider: "sec-edgar",
    externalId: `sec-edgar:${row.accessionNumber}`,
    url: link,
    rawContent: {
      title: `${formType} - ${companyName} (${String(row.cik).padStart(10, "0")}) (Filer)`,
      summary,
      updated: timestamp,
      link,
      formType,
      accessionNumber: row.accessionNumber,
      cik: row.cik,
      source: "daily-index",
      dateFiled: row.dateFiled,
      fileName: row.fileName,
    },
    symbol,
    symbolSource: symbol ? "sec-cik-map" : "unresolved",
    companyName,
    type: formType,
    title,
    headline: formMeta.headline,
    eventCategory: formMeta.category,
    subcategory: formMeta.subcategory,
    itemCodes: null,
    timestamp,
    summary,
    confidence: 70,
    tags: [...formMeta.tags, "daily-index"],
  };
}

/** Dates to attempt reconcile: yesterday, and today (if published). */
export function dailyIndexCandidateDates(now: Date = new Date()): string[] {
  const today = yyyymmddInEt(now);
  const yesterday = addDaysYyyymmdd(today, -1);
  return [yesterday, today];
}

export function parseReconciledThrough(
  message: string | null | undefined,
): string | null {
  if (!message) return null;
  const match = message.match(/reconciledThrough=(\d{8})/);
  return match?.[1] ?? null;
}

export function formatReconciledThroughMessage(yyyymmdd: string): string {
  return `reconciledThrough=${yyyymmdd}`;
}

export { SEC_DAILY_INDEX_VENDOR_ID, secFormVendorSourceId };
