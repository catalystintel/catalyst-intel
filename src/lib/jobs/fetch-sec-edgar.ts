import { XMLParser } from "fast-xml-parser";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { catalysts, companies, rawSources } from "@/db/schema";
import { getTickerByCik } from "./ticker-lookup";

const FEED_URL =
  "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&output=atom&count=100";

export interface FetchSecEdgarResult {
  fetched: number;
  inserted: number;
  skipped: number;
  errors: number;
  ranAt: string;
}

interface AtomEntry {
  title?: string;
  link?: { "@_href"?: string };
  summary?: { "#text"?: string } | string;
  updated?: string;
  category?: { "@_term"?: string };
  id?: string;
}

function getUserAgent(): string {
  const userAgent = process.env.SEC_EDGAR_USER_AGENT;
  if (!userAgent) {
    throw new Error(
      "SEC_EDGAR_USER_AGENT env var is required (SEC requires a descriptive User-Agent, " +
        "e.g. 'you@email.com CatalystIntel/0.1').",
    );
  }
  return userAgent;
}

async function fetchFeedXml(userAgent: string): Promise<string> {
  const res = await fetch(FEED_URL, { headers: { "User-Agent": userAgent } });
  if (!res.ok) {
    throw new Error(`SEC EDGAR feed request failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parses titles like "8-K - PEDEVCO CORP (0001141197) (Filer)". */
function parseFilingTitle(title: string) {
  const match = title.match(/^(.+?) - (.+) \((\d+)\) \((?:Filer|Filed by|Subject)\)$/);
  if (!match) return null;
  const [, formType, companyName, cik] = match;
  return { formType, companyName: companyName.trim(), cik: Number(cik) };
}

function extractFiledDate(summaryText: string): string | null {
  const match = summaryText.match(/Filed:\s*([\d]{4}-[\d]{2}-[\d]{2})/);
  return match ? match[1] : null;
}

function toEntryArray(entry: unknown): AtomEntry[] {
  if (!entry) return [];
  return Array.isArray(entry) ? (entry as AtomEntry[]) : [entry as AtomEntry];
}

export async function fetchSecEdgar(): Promise<FetchSecEdgarResult> {
  const userAgent = getUserAgent();

  const [feedXml, tickerByCik] = await Promise.all([
    fetchFeedXml(userAgent),
    getTickerByCik(userAgent),
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
        typeof entry.summary === "string" ? entry.summary : entry.summary?.["#text"] ?? "";
      const summaryText = stripHtml(rawSummary);

      const filedDate = extractFiledDate(summaryText);
      const timestamp = filedDate
        ? new Date(filedDate).toISOString()
        : entry.updated
          ? new Date(entry.updated).toISOString()
          : new Date().toISOString();

      const formType = parsedTitle?.formType ?? entry.category?.["@_term"] ?? "8-K";
      const companyName = parsedTitle?.companyName ?? rawTitle;
      const ticker = parsedTitle ? tickerByCik.get(parsedTitle.cik) ?? null : null;

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
          type: formType,
          title: `${companyName} \u2014 ${formType} filing`,
          timestamp,
          rawSourceId: rawRow.id,
        })
        .run();

      inserted++;
    } catch {
      errors++;
    }
  }

  return { fetched: entries.length, inserted, skipped, errors, ranAt: new Date().toISOString() };
}
