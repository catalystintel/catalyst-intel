import { XMLParser } from "fast-xml-parser";

import {
  ingestNormalizedCatalysts,
  toSourceResult,
  type NormalizedCatalyst,
  type SourceFetchResult,
} from "@/lib/jobs/ingest-pipeline";

/**
 * Nasdaq Trader Trade Halts RSS.
 * Free, no API key. Soft-fails on network errors (returned as status=error).
 */
export const NASDAQ_HALT_RSS_URL =
  "https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts";

interface RssItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  guid?: string | { "#text"?: string };
}

function toItemArray(item: unknown): RssItem[] {
  if (!item) return [];
  return Array.isArray(item) ? (item as RssItem[]) : [item as RssItem];
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function guidText(guid: RssItem["guid"]): string | null {
  if (!guid) return null;
  if (typeof guid === "string") return guid;
  return guid["#text"] ?? null;
}

/** Exported for unit tests. */
export function parseHaltTitle(title: string): {
  ticker: string | null;
  headline: string;
  subcategory: "halt" | "halt_resumed" | "trading_halt";
} {
  const cleaned = title.trim();
  const tickerMatch = cleaned.match(/\b([A-Z]{1,5})\b/);
  const ticker = tickerMatch?.[1] ?? null;
  const lower = cleaned.toLowerCase();

  if (/resum/.test(lower)) {
    return {
      ticker,
      headline: "Halt resumed",
      subcategory: "halt_resumed",
    };
  }
  if (/halt/.test(lower)) {
    return {
      ticker,
      headline: "Trading halt",
      subcategory: "halt",
    };
  }
  return {
    ticker,
    headline: cleaned.slice(0, 80) || "Exchange trading halt",
    subcategory: "trading_halt",
  };
}

function rssItemToNormalized(item: RssItem): NormalizedCatalyst | null {
  const title = String(item.title ?? "").trim();
  if (!title) return null;

  const link = item.link?.trim() || null;
  const description = stripHtml(String(item.description ?? ""));
  const guid = guidText(item.guid) ?? link ?? title;
  const parsed = parseHaltTitle(title);
  const timestamp = item.pubDate
    ? new Date(item.pubDate).toISOString()
    : new Date().toISOString();

  return {
    provider: "nasdaq-halts",
    externalId: `nasdaq-halts:${guid}`,
    url: link,
    rawContent: {
      title,
      description,
      pubDate: item.pubDate ?? null,
      link,
      guid,
    },
    ticker: parsed.ticker,
    companyName: parsed.ticker,
    type: "Trading Halt",
    title: parsed.ticker ? `${parsed.ticker} — ${parsed.headline}` : title,
    headline: parsed.headline,
    eventCategory: "trading_halt",
    subcategory: parsed.subcategory,
    timestamp,
    summary: description || title,
    confidence: 80,
    tags: ["exchange", "trading_halt", parsed.subcategory],
  };
}

/**
 * Pulls Nasdaq Trader halt RSS into catalysts.
 * Always "configured" (no key); network failures surface as thrown errors
 * for the orchestrator's allSettled path.
 */
export async function fetchNasdaqHalts(): Promise<SourceFetchResult> {
  const res = await fetch(NASDAQ_HALT_RSS_URL, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml, */*",
      "User-Agent": "CatalystIntel/0.1 (halts ingest)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    throw new Error(
      `Nasdaq halt RSS failed (${res.status}): ${res.statusText}`,
    );
  }

  const xml = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });
  const parsed = parser.parse(xml);
  const items = toItemArray(parsed?.rss?.channel?.item);

  const normalized = items
    .map(rssItemToNormalized)
    .filter((n): n is NormalizedCatalyst => n !== null);

  const result = await ingestNormalizedCatalysts(normalized, { purge: false });
  return toSourceResult("nasdaq-halts", result);
}
