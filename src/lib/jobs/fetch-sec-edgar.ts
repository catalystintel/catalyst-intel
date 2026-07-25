import { XMLParser } from "fast-xml-parser";

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
  formatProspectusOfferingTitle,
  formatSchedule13DTitle,
  formatSchedule13GTitle,
  formatSec8kItemTitle,
  formatShelfRegistrationTitle,
  form4TitleKindFromSubcategory,
} from "@/lib/catalysts/catalyst-titles";
import {
  classifySecFormType,
  parseFilingSummary,
  selectPrimaryItem,
} from "@/lib/jobs/parse-8k-items";
import {
  accessionToFolder,
  candidateForm4XmlUrls,
  extractForm4XmlHrefsFromIndex,
  isForm4Normalized,
  parseForm4OwnershipXml,
} from "@/lib/jobs/parse-form4";

import {
  type SecFetchMode,
  fetchSecUrl,
  getSecUserAgent,
} from "./sec-edgar-http";
import { getTickerByCik } from "./ticker-lookup";

/**
 * Current filing Atom feeds live on www.sec.gov (Akamai CDN), not data.sec.gov.
 * data.sec.gov hosts JSON submissions APIs; there is no equivalent Atom feed there.
 */
const SEC_FEED_TYPES = [
  { type: "8-K", count: 100 },
  { type: "4", count: 40 },
  { type: "S-3", count: 40 },
  { type: "424B", count: 40 },
  { type: "SC 13D", count: 40 },
  { type: "SC 13G", count: 40 },
] as const;

export type FetchSecEdgarResult = IngestPipelineResult & {
  feeds: { type: string; fetched: number; errors: number }[];
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

/** Parses titles like "8-K - PEDEVCO CORP (0001141197) (Filer)". */
export function parseFilingTitle(title: string) {
  const match = title.match(
    /^(.+?) - (.+) \((\d+)\) \((?:Filer|Filed by|Subject)\)$/,
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

function feedUrlForType(formType: string, count: number): string {
  const encoded = encodeURIComponent(formType);
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=${encoded}&output=atom&count=${count}`;
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

function entryToNormalized(
  entry: AtomEntry,
  tickerByCik: Map<number, string>,
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
  const ticker = parsedTitle
    ? (tickerByCik.get(parsedTitle.cik) ?? null)
    : null;
  const tickerSource = parsedTitle
    ? ticker
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
      title = formatSec8kItemTitle(primary.label, companyName);
    }
  } else if (isForm4) {
    title = formatForm4InsiderTitle("transaction", companyName);
  } else if (formMeta.subcategory === "s3") {
    title = formatShelfRegistrationTitle(companyName);
  } else if (formMeta.subcategory === "424b") {
    title = formatProspectusOfferingTitle(companyName);
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
    ticker,
    tickerSource,
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
 * Fetches current SEC EDGAR Atom feeds (8-K + Form 4, S-3/424B, 13D/G),
 * normalizes, dedupes by accession, and inserts catalysts.
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

  const tickerByCik = await getTickerByCik(userAgent, { mode });

  const feedStats: { type: string; fetched: number; errors: number }[] = [];
  const normalized: NormalizedCatalyst[] = [];

  for (const feed of feeds) {
    let fetched = 0;
    let errors = 0;
    try {
      const res = await fetchSecUrl(feedUrlForType(feed.type, feed.count), {
        userAgent,
        mode,
      });
      const feedXml = await res.text();
      const entries = parseFeedXml(feedXml);
      fetched = entries.length;

      for (const entry of entries) {
        try {
          const item = entryToNormalized(entry, tickerByCik);
          if (!item) {
            errors++;
            continue;
          }
          normalized.push(item);
        } catch {
          errors++;
        }
      }
    } catch {
      errors++;
    }
    feedStats.push({ type: feed.type, fetched, errors });
  }

  const seen = new Set<string>();
  const unique = normalized.filter((item) => {
    if (seen.has(item.externalId)) return false;
    seen.add(item.externalId);
    return true;
  });

  await enrichForm4Directions(unique, { userAgent, mode });

  const result = await ingestNormalizedCatalysts(unique, {
    purge: options.purge !== false,
  });

  return {
    ...result,
    fetched: unique.length,
    feeds: feedStats,
  };
}
