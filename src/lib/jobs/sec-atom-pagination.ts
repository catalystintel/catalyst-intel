/**
 * Pure helpers for SEC Atom `getcurrent` overflow pagination.
 * EDGAR max `count` is 100; `start` pages deeper into the rolling current list.
 */

/** EDGAR max page size for browse-edgar getcurrent. */
export const SEC_ATOM_PAGE_SIZE = 100;
/**
 * Hard cap so one tick cannot burn the RPS budget.
 * 10 × 100 = 1000 filings/form — sized for hourly cron catch-up bursts
 * (Form 4 spikes); deeper gaps still reconcile via daily-index.
 */
export const SEC_ATOM_MAX_PAGES = 10;

export function secFormVendorSourceId(formType: string): string {
  return `sec-edgar:${formType}`;
}

export const SEC_DAILY_INDEX_VENDOR_ID = "sec-edgar:daily-index";

export function feedUrlForType(
  formType: string,
  count: number,
  start = 0,
): string {
  const encoded = encodeURIComponent(formType);
  const startParam = start > 0 ? `&start=${start}` : "";
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=${encoded}&output=atom&count=${count}${startParam}`;
}

export function accessionFromAtomId(
  id: string | null | undefined,
): string | null {
  if (!id) return null;
  return String(id).match(/accession-number=([\w-]+)/)?.[1] ?? null;
}

export type AtomPaginationDecisionInput = {
  /** 0-based page index just fetched. */
  pageIndex: number;
  /** Entries returned on this page. */
  pageEntryCount: number;
  pageSize?: number;
  maxPages?: number;
  /** True if any accession on this page is already in raw_sources. */
  knownHit: boolean;
  /** Per-form watermark (newest Atom `updated` from a prior successful tick). */
  watermarkIso: string | null;
  /** Oldest `updated` on this page (ISO), when available. */
  oldestUpdatedIso: string | null;
};

/**
 * Whether to request the next `start+=pageSize` Atom page.
 *
 * Continue when the page is full, we have not hit known accessions yet, and
 * either there is no watermark (cold start / catch-up) or the oldest entry on
 * the page is still newer than the watermark (gap / overflow).
 */
export function shouldPaginateFurther(
  input: AtomPaginationDecisionInput,
): boolean {
  const pageSize = input.pageSize ?? SEC_ATOM_PAGE_SIZE;
  const maxPages = input.maxPages ?? SEC_ATOM_MAX_PAGES;

  if (input.pageIndex + 1 >= maxPages) return false;
  if (input.pageEntryCount < pageSize) return false;
  if (input.knownHit) return false;

  if (!input.watermarkIso) return true;

  if (!input.oldestUpdatedIso) return true;

  const oldestMs = Date.parse(input.oldestUpdatedIso);
  const watermarkMs = Date.parse(input.watermarkIso);
  if (!Number.isFinite(oldestMs) || !Number.isFinite(watermarkMs)) return true;

  // Oldest on page still after watermark → may still be catching up.
  return oldestMs > watermarkMs;
}

/** Newest ISO among entry updated strings (invalid ignored). */
export function newestUpdatedIso(
  updatedList: Array<string | null | undefined>,
): string | null {
  let bestMs = -Infinity;
  let best: string | null = null;
  for (const u of updatedList) {
    if (!u) continue;
    const ms = Date.parse(u);
    if (!Number.isFinite(ms)) continue;
    if (ms > bestMs) {
      bestMs = ms;
      best = new Date(ms).toISOString();
    }
  }
  return best;
}

/** Oldest ISO among entry updated strings. */
export function oldestUpdatedIso(
  updatedList: Array<string | null | undefined>,
): string | null {
  let bestMs = Infinity;
  let best: string | null = null;
  for (const u of updatedList) {
    if (!u) continue;
    const ms = Date.parse(u);
    if (!Number.isFinite(ms)) continue;
    if (ms < bestMs) {
      bestMs = ms;
      best = new Date(ms).toISOString();
    }
  }
  return best;
}
