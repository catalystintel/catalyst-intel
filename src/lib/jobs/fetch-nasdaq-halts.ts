import { XMLParser } from "fast-xml-parser";

import { formatHaltTitle } from "@/lib/catalysts/catalyst-titles";
import {
  haltReasonLabel,
  isPauseHaltCode,
  isResumeHaltCode,
  normalizeHaltReasonCode,
} from "@/lib/catalysts/halt-reason-codes";
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

/** Synthetic permalink — RSS items have no per-halt `<link>`. */
export const NASDAQ_HALTS_PAGE_URL =
  "https://www.nasdaqtrader.com/Trader.aspx?id=TradeHalts";

interface RssItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  guid?: string | { "#text"?: string };
  "ndaq:HaltDate"?: unknown;
  "ndaq:HaltTime"?: unknown;
  "ndaq:IssueSymbol"?: unknown;
  "ndaq:IssueName"?: unknown;
  "ndaq:Market"?: unknown;
  "ndaq:ReasonCode"?: unknown;
  "ndaq:PauseThresholdPrice"?: unknown;
  "ndaq:ResumptionDate"?: unknown;
  "ndaq:ResumptionQuoteTime"?: unknown;
  "ndaq:ResumptionTradeTime"?: unknown;
  /** Parser may strip the prefix depending on options. */
  HaltDate?: unknown;
  HaltTime?: unknown;
  IssueSymbol?: unknown;
  IssueName?: unknown;
  Market?: unknown;
  ReasonCode?: unknown;
  PauseThresholdPrice?: unknown;
  ResumptionDate?: unknown;
  ResumptionQuoteTime?: unknown;
  ResumptionTradeTime?: unknown;
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

/** Pull text from a fast-xml-parser node (string, `#text`, or empty). */
export function xmlText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t || null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("#text" in record) return xmlText(record["#text"]);
  }
  return null;
}

function ndaqField(item: RssItem, name: string): string | null {
  const record = item as Record<string, unknown>;
  return xmlText(record[`ndaq:${name}`]) ?? xmlText(record[name]);
}

export interface ParsedHaltFields {
  symbol: string | null;
  issueName: string | null;
  reasonCode: string | null;
  reasonLabel: string;
  market: string | null;
  haltDate: string | null;
  haltTime: string | null;
  pauseThresholdPrice: string | null;
  resumptionDate: string | null;
  resumptionQuoteTime: string | null;
  resumptionTradeTime: string | null;
  subcategory: "halt" | "halt_resumed" | "trading_halt";
  companyName: string;
  title: string;
  headline: string;
}

/**
 * Parse structured `ndaq:*` fields (with title fallback) into halt display fields.
 * Exported for unit tests.
 */
export function parseHaltRssItem(item: RssItem): ParsedHaltFields | null {
  const title = String(item.title ?? "").trim();
  const symbol =
    ndaqField(item, "IssueSymbol")?.toUpperCase() ||
    title.match(/\b([A-Z]{1,5})\b/)?.[1] ||
    null;
  if (!symbol && !title) return null;

  const issueName = ndaqField(item, "IssueName");
  const reasonCode = normalizeHaltReasonCode(ndaqField(item, "ReasonCode"));
  const reasonLabel = haltReasonLabel(reasonCode);
  const market = ndaqField(item, "Market");
  const haltDate = ndaqField(item, "HaltDate");
  const haltTime = ndaqField(item, "HaltTime");
  const pauseThresholdPrice = ndaqField(item, "PauseThresholdPrice");
  const resumptionDate = ndaqField(item, "ResumptionDate");
  const resumptionQuoteTime = ndaqField(item, "ResumptionQuoteTime");
  const resumptionTradeTime = ndaqField(item, "ResumptionTradeTime");

  const hasResumption =
    Boolean(resumptionTradeTime) ||
    Boolean(resumptionQuoteTime) ||
    isResumeHaltCode(reasonCode);

  let subcategory: ParsedHaltFields["subcategory"] = "trading_halt";
  if (hasResumption) {
    subcategory = "halt_resumed";
  } else if (reasonCode || isPauseHaltCode(reasonCode)) {
    subcategory = "halt";
  }

  const companyName = issueName?.trim() || symbol || "Unknown company";
  const displayTitle = formatHaltTitle(companyName, reasonCode);

  return {
    symbol,
    issueName,
    reasonCode,
    reasonLabel,
    market,
    haltDate,
    haltTime,
    pauseThresholdPrice,
    resumptionDate,
    resumptionQuoteTime,
    resumptionTradeTime,
    subcategory,
    companyName,
    title: displayTitle,
    headline: displayTitle,
  };
}

/**
 * Legacy title parser kept for older tests / callers that only have the RSS
 * `<title>` (often symbol-only). Prefer {@link parseHaltRssItem}.
 */
export function parseHaltTitle(title: string): {
  symbol: string | null;
  headline: string;
  subcategory: "halt" | "halt_resumed" | "trading_halt";
} {
  const cleaned = title.trim();
  const symbolMatch = cleaned.match(/\b([A-Z]{1,5})\b/);
  const symbol = symbolMatch?.[1] ?? null;
  const lower = cleaned.toLowerCase();

  if (/resum/.test(lower)) {
    return {
      symbol,
      headline: "Halt resumed",
      subcategory: "halt_resumed",
    };
  }
  if (/halt/.test(lower)) {
    return {
      symbol,
      headline: "Trading halt",
      subcategory: "halt",
    };
  }
  return {
    symbol,
    headline: cleaned.slice(0, 80) || "Exchange trading halt",
    subcategory: "trading_halt",
  };
}

function rssItemToNormalized(item: RssItem): NormalizedCatalyst | null {
  const parsed = parseHaltRssItem(item);
  if (!parsed) return null;

  const link = item.link?.trim() || null;
  const description = stripHtml(String(item.description ?? ""));
  const structuredKey = [
    parsed.symbol,
    parsed.haltDate,
    parsed.haltTime,
    parsed.reasonCode,
  ]
    .filter(Boolean)
    .join("|");
  const guid =
    guidText(item.guid) ||
    structuredKey ||
    String(item.title ?? "").trim() ||
    "unknown";
  const externalKey = structuredKey || guid;

  const timestamp = (() => {
    if (parsed.haltDate && parsed.haltTime) {
      // HaltDate is MM/DD/YYYY; HaltTime is ET wall clock — store as best-effort ISO.
      const [mm, dd, yyyy] = parsed.haltDate.split("/");
      if (mm && dd && yyyy) {
        const time = parsed.haltTime.replace(/(\.\d+)?$/, "");
        const iso = new Date(`${yyyy}-${mm}-${dd}T${time}`);
        if (!Number.isNaN(iso.getTime())) return iso.toISOString();
      }
    }
    if (item.pubDate) {
      const fromPub = new Date(item.pubDate);
      if (!Number.isNaN(fromPub.getTime())) return fromPub.toISOString();
    }
    return new Date().toISOString();
  })();

  const summary =
    [
      parsed.symbol,
      parsed.companyName !== parsed.symbol ? parsed.companyName : null,
      parsed.reasonLabel,
      parsed.market ? `Market ${parsed.market}` : null,
      parsed.haltDate && parsed.haltTime
        ? `Halted ${parsed.haltDate} ${parsed.haltTime}`
        : null,
      parsed.resumptionTradeTime
        ? `Resume trade ${parsed.resumptionTradeTime}`
        : null,
    ]
      .filter(Boolean)
      .join(" · ") ||
    description ||
    parsed.title;

  return {
    provider: "nasdaq-halts",
    externalId: `nasdaq-halts:${externalKey}`,
    url: link || NASDAQ_HALTS_PAGE_URL,
    rawContent: {
      title: String(item.title ?? "").trim() || null,
      description,
      pubDate: item.pubDate ?? null,
      link,
      guid,
      issueSymbol: parsed.symbol,
      issueName: parsed.issueName,
      market: parsed.market,
      reasonCode: parsed.reasonCode,
      reasonLabel: parsed.reasonLabel,
      haltDate: parsed.haltDate,
      haltTime: parsed.haltTime,
      pauseThresholdPrice: parsed.pauseThresholdPrice,
      resumptionDate: parsed.resumptionDate,
      resumptionQuoteTime: parsed.resumptionQuoteTime,
      resumptionTradeTime: parsed.resumptionTradeTime,
      resumptionTime:
        parsed.resumptionTradeTime ||
        parsed.resumptionQuoteTime ||
        parsed.resumptionDate,
    },
    symbol: parsed.symbol,
    companyName: parsed.companyName,
    type: "Trading Halt",
    title: parsed.title,
    headline: parsed.headline,
    eventCategory: "trading_halt",
    subcategory: parsed.subcategory,
    timestamp,
    summary,
    confidence: 80,
    tags: [
      "exchange",
      "trading_halt",
      parsed.subcategory,
      ...(parsed.reasonCode ? [parsed.reasonCode] : []),
    ],
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
