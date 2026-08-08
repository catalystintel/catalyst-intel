import { XMLParser } from "fast-xml-parser";
import { inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { rawSources } from "@/db/schema";
import {
  ingestNormalizedCatalysts,
  type IngestPipelineResult,
  type NormalizedCatalyst,
} from "@/lib/jobs/ingest-pipeline";
import {
  earningsDateForQuarterInference,
  earningsQuarterLabel,
  formatEarningsReportTitle,
  formatForm4InsiderTitle,
  format425MergerTitle,
  formatProspectusOfferingTitle,
  formatSchedule13DTitle,
  formatSchedule13GTitle,
  formatSec8kItemTitle,
  formatShelfRegistrationTitle,
  form4TitleKindFromSubcategory,
} from "@/lib/catalysts/catalyst-titles";
import {
  classifySecFormType,
  extractSecItemBlurb,
  parseFilingSummary,
  selectPrimaryItem,
} from "@/lib/jobs/parse-8k-items";
import {
  enrichSecFilingDocuments,
  sanitizeSecAtomSummaries,
} from "@/lib/jobs/enrich-sec-filings";
import {
  accessionToFolder,
  candidateForm4XmlUrls,
  extractForm4XmlHrefsFromIndex,
  isForm4Normalized,
  parseForm4OwnershipXml,
} from "@/lib/jobs/parse-form4";

import {
  SEC_ATOM_MAX_PAGES,
  SEC_ATOM_PAGE_SIZE,
  accessionFromAtomId,
  feedUrlForType,
  newestUpdatedIso,
  oldestUpdatedIso,
  secFormVendorSourceId,
  shouldPaginateFurther,
} from "./sec-atom-pagination";
import {
  SEC_DAILY_INDEX_VENDOR_ID,
  dailyIndexCandidateDates,
  formatReconciledThroughMessage,
  masterIdxUrl,
  masterRowToNormalized,
  parseMasterIdx,
  parseReconciledThrough,
} from "./sec-daily-index";
import {
  type SecFetchMode,
  SecEdgarRequestError,
  fetchSecUrl,
  getSecUserAgent,
} from "./sec-edgar-http";
import { getSymbolByCik } from "./symbol-lookup";
import {
  getVendorFetchState,
  touchVendorFetchState,
} from "./vendor-fetch-state";

/**
 * Current filing Atom feeds live on www.sec.gov (Akamai CDN), not data.sec.gov.
 * data.sec.gov hosts JSON submissions APIs; there is no equivalent Atom feed there.
 * count=100 is EDGAR max; overflow uses `start=` pagination (see sec-atom-pagination).
 */
const SEC_FEED_TYPES = [
  { type: "8-K", count: SEC_ATOM_PAGE_SIZE },
  { type: "4", count: SEC_ATOM_PAGE_SIZE },
  { type: "S-3", count: SEC_ATOM_PAGE_SIZE },
  { type: "424B", count: SEC_ATOM_PAGE_SIZE },
  { type: "425", count: SEC_ATOM_PAGE_SIZE },
  { type: "SC 13D", count: SEC_ATOM_PAGE_SIZE },
  { type: "SC 13G", count: SEC_ATOM_PAGE_SIZE },
] as const;

export type SecFeedFetchStats = {
  type: string;
  fetched: number;
  errors: number;
  pages: number;
  overflowTriggered: boolean;
  hitMaxPages: boolean;
};

export type FetchSecEdgarResult = IngestPipelineResult & {
  feeds: SecFeedFetchStats[];
  message?: string;
};

export interface FetchSecEdgarOptions {
  /** Defaults to `primary` (admin / GHA cron). Background self-heal uses shorter timeouts. */
  mode?: SecFetchMode;
  /** Limit which form types to pull (defaults to all configured feeds). */
  formTypes?: string[];
  /**
   * Run 30-day retention after insert. Defaults to true for standalone SEC
   * runs; the multi-source orchestrator sets false and purges once at the end
   * so parallel keyless inserts are not deleted mid-flight.
   */
  purge?: boolean;
}

interface AtomEntry {
  title?: string;
  link?: { "@_href"?: string };
  summary?: { "#text"?: string } | string;
  updated?: string;
  category?: { "@_term"?: string };
  id?: string;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses titles like "8-K - PEDEVCO CORP (0001141197) (Filer)".
 * Form 3/4/5 Atom entries use "(Reporting)" instead of "(Filer)" for the
 * insider's own role — without it here, the regex silently fails and the
 * entry falls back to the raw, unparsed title with no CIK/ticker.
 */
export function parseFilingTitle(title: string) {
  const match = title.match(
    /^(.+?) - (.+) \((\d+)\) \((?:Filer|Filed by|Subject|Reporting)\)$/,
  );
  if (!match) return null;
  const [, formType, companyName, cik] = match;
  return { formType, companyName: companyName.trim(), cik: Number(cik) };
}

export function extractFiledDate(summaryText: string): string | null {
  const match = summaryText.match(/Filed:\s*([\d]{4}-[\d]{2}-[\d]{2})/);
  return match ? match[1] : null;
}

function toEntryArray(entry: unknown): AtomEntry[] {
  if (!entry) return [];
  return Array.isArray(entry) ? (entry as AtomEntry[]) : [entry as AtomEntry];
}

function parseFeedXml(feedXml: string): AtomEntry[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });
  const parsed = parser.parse(feedXml);
  return toEntryArray(parsed?.feed?.entry);
}

async function findExistingSecExternalIds(
  externalIds: string[],
): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();
  const rows = await db
    .select({ externalId: rawSources.externalId })
    .from(rawSources)
    .where(inArray(rawSources.externalId, externalIds))
    .all();
  return new Set(rows.map((r) => r.externalId));
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function entryToNormalized(
  entry: AtomEntry,
  symbolByCik: Map<number, string>,
): NormalizedCatalyst | null {
  const idText = String(entry.id ?? "");
  const accessionNumber = idText.match(/accession-number=([\w-]+)/)?.[1];
  if (!accessionNumber) return null;

  const rawTitle = String(entry.title ?? "");
  const parsedTitle = parseFilingTitle(rawTitle);
  const link = entry.link?.["@_href"] ?? null;
  const rawSummary =
    typeof entry.summary === "string"
      ? entry.summary
      : (entry.summary?.["#text"] ?? "");
  const summaryText = stripHtml(rawSummary);

  const filedDate = extractFiledDate(summaryText);
  const timestamp = entry.updated
    ? new Date(entry.updated).toISOString()
    : filedDate
      ? new Date(filedDate).toISOString()
      : new Date().toISOString();

  const formType = parsedTitle?.formType ?? entry.category?.["@_term"] ?? "8-K";
  const companyName = parsedTitle?.companyName ?? rawTitle;
  const cik = parsedTitle?.cik ?? null;
  const symbol = parsedTitle
    ? (symbolByCik.get(parsedTitle.cik) ?? null)
    : null;
  const symbolSource = parsedTitle
    ? symbol
      ? "sec-cik-map"
      : "unresolved"
    : null;

  const is8k = /^8-?K/i.test(formType);
  const formMeta = classifySecFormType(formType);

  let eventCategory = formMeta.category;
  let headline = formMeta.headline;
  let subcategory = formMeta.subcategory;
  let tags = formMeta.tags;
  let itemCodes = null as ReturnType<typeof parseFilingSummary>["items"] | null;

  if (is8k) {
    const parsed = parseFilingSummary(summaryText);
    eventCategory = parsed.primaryCategory;
    headline = parsed.headline;
    subcategory = "8k";
    itemCodes = parsed.items;
    tags = ["8k", ...(parsed.items.map((i) => `item-${i.code}`) ?? [])];
  }

  const isItem202Earnings =
    eventCategory === "earnings" &&
    (itemCodes?.some((i) => i.code === "2.02") ||
      /^earnings\s*\/\s*results$/i.test(headline ?? ""));

  const isForm4 =
    formMeta.subcategory === "form4" || /^4(\/|$)/i.test(formType);

  let title = `${companyName} \u2014 ${formType} filing`;
  if (isItem202Earnings) {
    // Ground-rule tape title; quarter from Filed: date / filing timestamp.
    const quarter = earningsQuarterLabel(
      null,
      earningsDateForQuarterInference({
        summary: summaryText,
        timestamp,
      }),
    );
    title = formatEarningsReportTitle(quarter, companyName);
    headline = title;
    tags = [...(tags ?? []), quarter];
  } else if (is8k && itemCodes?.length) {
    const primary = selectPrimaryItem(itemCodes);
    if (primary) {
      title = formatSec8kItemTitle(primary.label, companyName, {
        content: summaryText,
      });
    }
  } else if (is8k) {
    // Never leave a bare "8-K filing" title — prefer Item blurb, else Current Report.
    const blurb = extractSecItemBlurb(summaryText, null, 110);
    if (blurb) {
      title = `${companyName} - ${blurb}`;
      if (!itemCodes?.length) headline = blurb;
    } else {
      title = formatSec8kItemTitle("Current report", companyName);
      headline = "Current report";
    }
  } else if (isForm4) {
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
  }

  return {
    provider: "sec-edgar",
    externalId: `sec-edgar:${accessionNumber}`,
    url: link,
    rawContent: {
      title: rawTitle,
      summary: summaryText,
      updated: entry.updated ?? null,
      link,
      formType,
      accessionNumber,
      cik,
    },
    symbol,
    symbolSource,
    companyName,
    type: formType,
    title,
    headline,
    eventCategory,
    subcategory,
    itemCodes,
    timestamp,
    summary: summaryText || null,
    confidence: is8k ? 85 : 75,
    tags,
  };
}

/**
 * Cap-fetch Form 4 ownership XML to label insider buy / sell / mixed.
 * Soft-fails per row — Atom entries still ingest as generic `form4`.
 */
export async function enrichForm4Directions(
  items: NormalizedCatalyst[],
  options: { userAgent: string; mode?: SecFetchMode },
): Promise<void> {
  const cap = options.mode === "background" ? 6 : 15;
  let attempted = 0;

  for (const item of items) {
    if (!isForm4Normalized(item)) continue;
    if (attempted >= cap) break;

    const raw = item.rawContent as Record<string, unknown>;
    const cik = raw.cik as number | undefined;
    const accessionNumber = raw.accessionNumber as string | undefined;
    if (!cik || !accessionNumber) {
      continue;
    }

    attempted++;

    try {
      const folder = accessionToFolder(accessionNumber);
      const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${folder}/${accessionNumber}-index.htm`;
      let xmlUrls = candidateForm4XmlUrls(cik, accessionNumber);

      try {
        const indexRes = await fetchSecUrl(indexUrl, {
          userAgent: options.userAgent,
          mode: options.mode ?? "primary",
        });
        if (indexRes.ok) {
          const indexHtml = await indexRes.text();
          const fromIndex = extractForm4XmlHrefsFromIndex(
            indexHtml,
            cik,
            accessionNumber,
          );
          if (fromIndex.length > 0) {
            xmlUrls = [...fromIndex, ...xmlUrls];
          }
        }
      } catch {
        // Index lookup is best-effort.
      }

      for (const url of xmlUrls) {
        try {
          const res = await fetchSecUrl(url, {
            userAgent: options.userAgent,
            mode: options.mode ?? "primary",
          });
          if (!res.ok) continue;
          const xml = await res.text();
          const direction = parseForm4OwnershipXml(xml);
          if (!direction) continue;

          item.subcategory = direction.subcategory;
          item.headline = direction.headline;
          item.tags = [...(item.tags ?? []), direction.subcategory];
          item.title = formatForm4InsiderTitle(
            form4TitleKindFromSubcategory(direction.subcategory),
            item.companyName,
          );
          // Mirror ground-rule title onto headline for tape preference.
          if (
            direction.subcategory === "insider_buy" ||
            direction.subcategory === "insider_sell" ||
            direction.subcategory === "form4_mixed"
          ) {
            item.headline = item.title;
          }
          raw.form4Direction = direction;
          if (direction.keyFacts?.length) {
            raw.extracted = {
              eventKind: direction.subcategory,
              completeness:
                direction.totalShares != null || direction.totalValue != null
                  ? "full"
                  : "partial",
              investorSummary: direction.investorSummary,
              bodySnippets: direction.investorSummary
                ? [direction.investorSummary]
                : [],
              keyFacts: direction.keyFacts,
              titleOverride: direction.titleOverride,
              headlineOverride: direction.headline,
              sourceDoc: url,
            };
          }
          if (direction.investorSummary) {
            item.summary = direction.investorSummary;
          }
          if (direction.titleOverride) {
            const symbol = item.symbol?.trim().toUpperCase();
            item.title = symbol
              ? `${symbol} — ${direction.titleOverride}`
              : direction.titleOverride;
          }
          break;
        } catch {
          continue;
        }
      }
    } catch {
      // Keep generic form4 when XML enrichment fails.
    }
  }
}

/**
 * Fetches current SEC EDGAR Atom feeds with overflow pagination, optionally
 * reconciles daily-index master.idx for gaps, normalizes, enriches, and inserts.
 */
export async function fetchSecEdgar(
  options: FetchSecEdgarOptions = {},
): Promise<FetchSecEdgarResult> {
  const mode = options.mode ?? "primary";
  const userAgent = getSecUserAgent();

  const feeds = SEC_FEED_TYPES.filter((f) =>
    options.formTypes
      ? options.formTypes.some((t) => t.toUpperCase() === f.type.toUpperCase())
      : true,
  );

  const symbolByCik = await getSymbolByCik(userAgent, { mode });

  const feedStats: SecFeedFetchStats[] = [];
  const normalized: NormalizedCatalyst[] = [];
  const noteParts: string[] = [];

  for (const feed of feeds) {
    let fetched = 0;
    let errors = 0;
    let pages = 0;
    let overflowTriggered = false;
    let hitMaxPages = false;
    let lastPageKnownHit = false;
    let lastPageFull = false;
    const pageUpdated: string[] = [];

    const formState = await getVendorFetchState(
      secFormVendorSourceId(feed.type),
    );
    const watermarkIso = formState?.lastFetchedAt ?? null;

    try {
      for (let pageIndex = 0; pageIndex < SEC_ATOM_MAX_PAGES; pageIndex++) {
        if (pageIndex > 0) {
          overflowTriggered = true;
          await sleep(120);
        }

        const start = pageIndex * feed.count;
        const res = await fetchSecUrl(
          feedUrlForType(feed.type, feed.count, start),
          { userAgent, mode },
        );
        const feedXml = await res.text();
        const entries = parseFeedXml(feedXml);
        pages++;
        fetched += entries.length;

        const accessionsOnPage: string[] = [];
        const updatedOnPage: Array<string | null> = [];

        for (const entry of entries) {
          const acc = accessionFromAtomId(entry.id);
          if (acc) accessionsOnPage.push(acc);
          updatedOnPage.push(entry.updated ?? null);
          if (entry.updated) pageUpdated.push(entry.updated);

          try {
            const item = entryToNormalized(entry, symbolByCik);
            if (!item) {
              errors++;
              continue;
            }
            normalized.push(item);
          } catch {
            errors++;
          }
        }

        const externalIds = accessionsOnPage.map((a) => `sec-edgar:${a}`);
        const existing = await findExistingSecExternalIds(externalIds);
        const knownHit = externalIds.some((id) => existing.has(id));
        lastPageKnownHit = knownHit;
        lastPageFull = entries.length >= feed.count;

        const continuePaging = shouldPaginateFurther({
          pageIndex,
          pageEntryCount: entries.length,
          pageSize: feed.count,
          maxPages: SEC_ATOM_MAX_PAGES,
          knownHit,
          watermarkIso,
          oldestUpdatedIso: oldestUpdatedIso(updatedOnPage),
        });

        if (!continuePaging) break;
      }

      hitMaxPages =
        pages >= SEC_ATOM_MAX_PAGES && lastPageFull && !lastPageKnownHit;

      const newest = newestUpdatedIso(pageUpdated);
      // Incomplete catch-up: hold watermark so we do not claim the gap is
      // closed. Next tick retries; daily-index still reconciles multi-hour misses.
      const message = hitMaxPages
        ? `pages=${pages};overflow;hitMaxPages`
        : overflowTriggered
          ? `pages=${pages};overflow`
          : `pages=${pages}`;
      await touchVendorFetchState({
        sourceId: secFormVendorSourceId(feed.type),
        status: "ok",
        message,
        advanceWatermark: !hitMaxPages,
        watermarkAt: hitMaxPages ? undefined : (newest ?? undefined),
      });
    } catch (error) {
      errors++;
      const rateLimited =
        error instanceof SecEdgarRequestError && error.status === 429;
      await touchVendorFetchState({
        sourceId: secFormVendorSourceId(feed.type),
        status: rateLimited ? "rate_limited" : "error",
        message:
          error instanceof Error ? error.message.slice(0, 200) : "feed error",
        advanceWatermark: false,
      });
    }

    if (overflowTriggered) {
      noteParts.push(`${feed.type}:pages=${pages}`);
    }
    if (hitMaxPages) {
      noteParts.push(`${feed.type}:hitMaxPages`);
    }

    feedStats.push({
      type: feed.type,
      fetched,
      errors,
      pages,
      overflowTriggered,
      hitMaxPages,
    });
  }

  // EOD / gap repair via daily-index master.idx (yesterday + today if published).
  try {
    const dailyItems = await fetchDailyIndexCatchUp({
      userAgent,
      mode,
      symbolByCik,
    });
    if (dailyItems.length > 0) {
      normalized.push(...dailyItems);
      noteParts.push(`daily-index:+${dailyItems.length}`);
    }
  } catch (error) {
    noteParts.push(
      `daily-index:error=${error instanceof Error ? error.message.slice(0, 80) : "fail"}`,
    );
  }

  const seen = new Set<string>();
  const unique = normalized.filter((item) => {
    if (seen.has(item.externalId)) return false;
    seen.add(item.externalId);
    return true;
  });

  await enrichForm4Directions(unique, { userAgent, mode });
  await enrichSecFilingDocuments(unique, { userAgent, mode });
  sanitizeSecAtomSummaries(unique);

  const result = await ingestNormalizedCatalysts(unique, {
    purge: options.purge !== false,
  });

  return {
    ...result,
    fetched: unique.length,
    feeds: feedStats,
    ...(noteParts.length > 0 ? { message: noteParts.join("; ") } : {}),
  };
}

/**
 * Download master.idx for candidate dates not yet reconciled; return
 * normalized rows for configured form types (caller dedupes + ingests).
 */
async function fetchDailyIndexCatchUp(options: {
  userAgent: string;
  mode: SecFetchMode;
  symbolByCik: Map<number, string>;
}): Promise<NormalizedCatalyst[]> {
  const state = await getVendorFetchState(SEC_DAILY_INDEX_VENDOR_ID);
  const reconciledThrough = parseReconciledThrough(state?.lastMessage);
  const candidates = dailyIndexCandidateDates();
  const out: NormalizedCatalyst[] = [];
  let latestReconciled = reconciledThrough;

  for (const yyyymmdd of candidates) {
    if (reconciledThrough && yyyymmdd <= reconciledThrough) continue;

    const url = masterIdxUrl(yyyymmdd);
    let text: string;
    try {
      const res = await fetchSecUrl(url, {
        userAgent: options.userAgent,
        mode: options.mode,
      });
      text = await res.text();
    } catch (error) {
      if (error instanceof SecEdgarRequestError && error.status === 404) {
        // Not published yet (today before EOD) — skip without failing the tick.
        continue;
      }
      throw error;
    }

    const rows = parseMasterIdx(text);
    const batch: NormalizedCatalyst[] = [];
    for (const row of rows) {
      const item = masterRowToNormalized(row, options.symbolByCik);
      if (item) batch.push(item);
    }

    const existing = await findExistingSecExternalIds(
      batch.map((item) => item.externalId),
    );
    for (const item of batch) {
      if (!existing.has(item.externalId)) out.push(item);
    }

    latestReconciled =
      !latestReconciled || yyyymmdd > latestReconciled
        ? yyyymmdd
        : latestReconciled;
  }

  if (latestReconciled && latestReconciled !== reconciledThrough) {
    const y = latestReconciled.slice(0, 4);
    const m = latestReconciled.slice(4, 6);
    const d = latestReconciled.slice(6, 8);
    await touchVendorFetchState({
      sourceId: SEC_DAILY_INDEX_VENDOR_ID,
      status: "ok",
      message: formatReconciledThroughMessage(latestReconciled),
      advanceWatermark: true,
      watermarkAt: new Date(`${y}-${m}-${d}T23:59:59.000Z`).toISOString(),
    });
  }

  return out;
}
