import { XMLParser } from "fast-xml-parser";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { catalysts, companies, rawSources } from "@/db/schema";
import { scoreFromCategory } from "@/lib/catalysts/materiality";

import { purgeStaleCatalysts } from "./data-retention";
import { parseFilingSummary } from "./parse-8k-items";
import {
  type SecFetchMode,
  fetchSecUrl,
  getSecUserAgent,
} from "./sec-edgar-http";
import { getTickerByCik } from "./ticker-lookup";

/**
 * Current 8-K Atom feed lives on www.sec.gov (Akamai CDN), not data.sec.gov.
 * data.sec.gov hosts JSON submissions APIs; there is no equivalent Atom feed there.
 */
const FEED_URL =
  "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&output=atom&count=100";

export interface FetchSecEdgarResult {
  fetched: number;
  inserted: number;
  skipped: number;
  errors: number;
  ranAt: string;
  purgedCatalysts: number;
  purgedRawSources: number;
}

export interface FetchSecEdgarOptions {
  /** Defaults to `primary` (admin / GHA cron). Background self-heal uses shorter timeouts. */
  mode?: SecFetchMode;
}

interface AtomEntry {
  title?: string;
  link?: { "@_href"?: string };
  summary?: { "#text"?: string } | string;
  updated?: string;
  category?: { "@_term"?: string };
  id?: string;
}

async function fetchFeedXml(
  userAgent: string,
  mode: SecFetchMode,
): Promise<string> {
  const res = await fetchSecUrl(FEED_URL, { userAgent, mode });
  return res.text();
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

export async function fetchSecEdgar(
  options: FetchSecEdgarOptions = {},
): Promise<FetchSecEdgarResult> {
  const mode = options.mode ?? "primary";
  const userAgent = getSecUserAgent();

  const [feedXml, tickerByCik] = await Promise.all([
    fetchFeedXml(userAgent, mode),
    getTickerByCik(userAgent, { mode }),
  ]);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });
  const parsed = parser.parse(feedXml);
  const entries = toEntryArray(parsed?.feed?.entry);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
      const idText = String(entry.id ?? "");
      const accessionNumber = idText.match(/accession-number=([\w-]+)/)?.[1];
      if (!accessionNumber) {
        errors++;
        continue;
      }

      const externalId = `sec-edgar:${accessionNumber}`;
      const alreadyStored = await db
        .select({ id: rawSources.id })
        .from(rawSources)
        .where(eq(rawSources.externalId, externalId))
        .get();

      if (alreadyStored) {
        skipped++;
        continue;
      }

      const rawTitle = String(entry.title ?? "");
      const parsedTitle = parseFilingTitle(rawTitle);
      const link = entry.link?.["@_href"] ?? null;
      const rawSummary =
        typeof entry.summary === "string"
          ? entry.summary
          : (entry.summary?.["#text"] ?? "");
      const summaryText = stripHtml(rawSummary);

      // `entry.updated` is the EDGAR acceptance datetime (precise to the second)
      // and is what makes the Live tape's "age" meaningful; the summary's
      // "Filed:" value is date-only, so it's only a fallback.
      const filedDate = extractFiledDate(summaryText);
      const timestamp = entry.updated
        ? new Date(entry.updated).toISOString()
        : filedDate
          ? new Date(filedDate).toISOString()
          : new Date().toISOString();

      const formType =
        parsedTitle?.formType ?? entry.category?.["@_term"] ?? "8-K";
      const companyName = parsedTitle?.companyName ?? rawTitle;
      const ticker = parsedTitle
        ? (tickerByCik.get(parsedTitle.cik) ?? null)
        : null;

      const { items, primaryCategory, headline } =
        parseFilingSummary(summaryText);

      const rawRow = await db
        .insert(rawSources)
        .values({
          provider: "sec-edgar",
          externalId,
          url: link,
          rawContent: {
            title: rawTitle,
            summary: summaryText,
            updated: entry.updated ?? null,
            link,
          },
        })
        .returning({ id: rawSources.id })
        .get();

      let companyId: number | null = null;
      if (ticker) {
        const existingCompany = await db
          .select({ id: companies.id })
          .from(companies)
          .where(eq(companies.ticker, ticker))
          .get();

        if (existingCompany) {
          companyId = existingCompany.id;
        } else {
          const insertedCompany = await db
            .insert(companies)
            .values({ name: companyName, ticker })
            .returning({ id: companies.id })
            .get();
          companyId = insertedCompany.id;
        }
      }

      await db
        .insert(catalysts)
        .values({
          companyId,
          ticker,
          companyName,
          type: formType,
          title: `${companyName} \u2014 ${formType} filing`,
          headline,
          eventCategory: primaryCategory,
          itemCodes: items,
          timestamp,
          rawSourceId: rawRow.id,
          impactScore: scoreFromCategory(primaryCategory),
        })
        .run();

      inserted++;
    } catch {
      errors++;
    }
  }

  // Retention is a housekeeping concern, not a reason to fail an otherwise
  // successful ingestion - log and move on if it errors.
  let purgedCatalysts = 0;
  let purgedRawSources = 0;
  try {
    const retentionResult = await purgeStaleCatalysts();
    purgedCatalysts = retentionResult.deletedCatalysts;
    purgedRawSources = retentionResult.deletedRawSources;
  } catch (error) {
    console.error("Data retention purge failed:", error);
  }

  return {
    fetched: entries.length,
    inserted,
    skipped,
    errors,
    ranAt: new Date().toISOString(),
    purgedCatalysts,
    purgedRawSources,
  };
}
