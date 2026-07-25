/**
 * Article body + summary helpers for the in-app catalyst reader.
 * Prefers stored vendor text (summary / description / Atom abstract) over
 * scraping arbitrary URLs. Heuristic extractive + metadata synthesis until
 * Groq is wired — never leave the reader with a blank or jargon-only blurb
 * when symbol / category / item codes exist.
 */

import {
  CATEGORY_LABELS,
  isEventCategoryKey,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";
import {
  buildEarningsIntro,
  isEarningsCatalyst,
  parseEarningsFromRaw,
} from "@/lib/catalysts/article-detail";

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z0-9"'(])/;

/** Strip simple HTML tags and collapse whitespace. */
export function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a short 2–3 sentence extractive summary from free text.
 * Falls back to a truncated paragraph when sentence boundaries are weak.
 */
export function extractiveSummary(
  text: string,
  options?: { maxSentences?: number; maxChars?: number },
): string {
  const maxSentences = options?.maxSentences ?? 3;
  const maxChars = options?.maxChars ?? 520;
  const cleaned = stripHtml(text);
  if (!cleaned) return "";

  const sentences = cleaned
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let out =
    sentences.length > 0 ? sentences.slice(0, maxSentences).join(" ") : cleaned;

  if (out.length > maxChars) {
    const cut = out.slice(0, maxChars);
    const lastSpace = cut.lastIndexOf(" ");
    out = `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
  }
  return out;
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
    if (typeof v === "string" && v.trim()) return stripHtml(v);
  }
  return null;
}

function joinFields(
  parts: Array<string | null | undefined>,
  sep = " · ",
): string | null {
  const cleaned = parts
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  return cleaned.length > 0 ? cleaned.join(sep) : null;
}

function categoryLabel(value?: string | null): string | null {
  if (!value) return null;
  if (isEventCategoryKey(value)) return CATEGORY_LABELS[value];
  return value.replace(/_/g, " ");
}

export type ArticleBodySource = "raw" | "summary" | "title" | "empty";

export interface ArticleBodyResult {
  body: string;
  source: ArticleBodySource;
}

export interface SummaryItemCode {
  code?: string | null;
  label?: string | null;
}

/**
 * Pull the best available article/filing body from stored raw_sources JSON
 * and catalyst fields. Does not fetch external HTML.
 */
export function extractArticleBody(input: {
  provider?: string | null;
  rawContent?: unknown;
  summary?: string | null;
  title?: string | null;
  headline?: string | null;
}): ArticleBodyResult {
  const provider = input.provider?.trim() || null;
  const raw = asRecord(input.rawContent);
  const storedSummary = input.summary?.trim() ? stripHtml(input.summary) : null;

  let fromRaw: string | null = null;

  switch (provider) {
    case "sec-edgar":
      fromRaw = stringField(raw, "summary", "description");
      break;
    case "nasdaq-halts":
      fromRaw = stringField(raw, "description", "summary", "title");
      break;
    case "macro-calendar":
      fromRaw = stringField(raw, "summary", "title");
      break;
    case "polygon":
      fromRaw = stringField(raw, "description", "summary", "title");
      break;
    case "finnhub": {
      const numLabel = (key: string, label: string): string | null => {
        const v = raw?.[key];
        if (v == null || v === "") return null;
        return `${label} ${String(v)}`;
      };
      fromRaw =
        stringField(raw, "summary", "description") ||
        joinFields([
          stringField(raw, "catalyst"),
          stringField(raw, "indication"),
          stringField(raw, "status"),
          numLabel("epsEstimate", "EPS est"),
          numLabel("epsActual", "EPS act"),
          numLabel("revenueEstimate", "Rev est"),
          numLabel("revenueActual", "Rev act"),
        ]);
      break;
    }
    case "openfda": {
      const submissions = Array.isArray(raw?.submissions)
        ? (raw.submissions as unknown[])
        : [];
      const firstSub = asRecord(submissions[0] ?? null);
      fromRaw =
        joinFields([
          stringField(raw, "sponsor_name"),
          stringField(raw, "brand_name"),
          stringField(firstSub, "submission_type", "submission_status"),
          stringField(
            firstSub,
            "submission_class_code_description",
            "submission_class_code",
          ),
        ]) || stringField(raw, "summary", "description");
      break;
    }
    case "clinicaltrials": {
      const proto = asRecord(raw?.protocolSection);
      const idMod = asRecord(proto?.identificationModule);
      const statusMod = asRecord(proto?.statusModule);
      const condMod = asRecord(proto?.conditionsModule);
      const conditions = Array.isArray(condMod?.conditions)
        ? (condMod.conditions as unknown[])
            .filter((c): c is string => typeof c === "string")
            .join(", ")
        : null;
      fromRaw =
        joinFields(
          [
            stringField(idMod, "briefTitle", "officialTitle"),
            stringField(statusMod, "overallStatus"),
            conditions,
          ],
          ". ",
        ) || stringField(raw, "summary", "description");
      break;
    }
    case "form4api":
      fromRaw =
        joinFields([
          stringField(raw, "transactionType", "amendmentType"),
          stringField(raw, "companyName", "company"),
          stringField(raw, "filedAt") ? `Filed ${String(raw?.filedAt)}` : null,
        ]) || stringField(raw, "summary", "description");
      break;
    default:
      fromRaw = stringField(
        raw,
        "summary",
        "description",
        "body",
        "content",
        "abstract",
        "text",
      );
  }

  if (fromRaw && fromRaw.length > 0) {
    return { body: fromRaw, source: "raw" };
  }
  if (storedSummary) {
    return { body: storedSummary, source: "summary" };
  }

  const titleFallback = joinFields([input.headline, input.title], " — ");
  if (titleFallback) {
    return { body: titleFallback, source: "title" };
  }

  return { body: "", source: "empty" };
}

export interface ArticleSummaryResult {
  summary: string;
  /** True when we synthesized text because stored summary was empty/weak. */
  generated: boolean;
}

export interface ArticleSummaryInput {
  summary?: string | null;
  title?: string | null;
  headline?: string | null;
  body?: string | null;
  symbol?: string | null;
  companyName?: string | null;
  eventCategory?: string | null;
  subcategory?: string | null;
  type?: string | null;
  itemCodes?: SummaryItemCode[] | null;
  provider?: string | null;
  rawContent?: unknown;
}

/** True when text looks like real prose (not a title join or abbreviation dump). */
function hasRealSentence(text: string): boolean {
  if (/[.!?]\s+[A-Z0-9"'(]/.test(text)) return true;
  if (
    /[.!?]$/.test(text) &&
    text.split(/\s+/).filter(Boolean).length >= 12 &&
    !/\b(Inc|Ltd|Corp|Co|LLC|LLP)\.\s*$/i.test(text)
  ) {
    return true;
  }
  return false;
}

/** True when text is too thin or code-like for a reader to understand alone. */
export function isWeakSummary(text: string | null | undefined): boolean {
  const cleaned = text?.trim() ? stripHtml(text) : "";
  if (!cleaned) return true;
  if (cleaned.length < 48) return true;

  const lower = cleaned.toLowerCase();
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (wordCount < 8) return true;

  // Title/headline joins and other non-prose blobs without a real sentence.
  if (!hasRealSentence(cleaned) && cleaned.length < 280) return true;

  // Item-code dumps / tag soup without a real sentence.
  const looksLikeItemDump =
    /^(item\s+\d+\.\d+\b.*?){1,}$/i.test(cleaned) &&
    !hasRealSentence(cleaned) &&
    wordCount < 16;
  if (looksLikeItemDump) return true;

  // Pure symbol / form labels.
  if (/^[A-Z]{1,5}\s*[—-]\s*(8-?K|Form\s*4|10-?[KQ]).*$/i.test(cleaned)) {
    return true;
  }
  if (
    /^(trading halt|halt resumed|earnings|news)$/i.test(cleaned) ||
    lower === "n/a" ||
    lower === "null"
  ) {
    return true;
  }

  return false;
}

function subjectPhrase(input: ArticleSummaryInput): string {
  const symbol = input.symbol?.trim().toUpperCase() || null;
  const company = input.companyName?.trim() || null;
  if (symbol && company && company.toUpperCase() !== symbol) {
    return `${company} (${symbol})`;
  }
  if (symbol) return symbol;
  if (company) return company;
  return "This issuer";
}

function eventPhrase(input: ArticleSummaryInput): string {
  const headline = input.headline?.trim() || null;
  const sub = input.subcategory?.trim()?.replace(/_/g, " ") || null;
  const type = input.type?.trim() || null;
  const cat = categoryLabel(input.eventCategory);
  return headline || sub || type || cat || "a market catalyst";
}

function itemSentence(itemCodes?: SummaryItemCode[] | null): string | null {
  if (!Array.isArray(itemCodes) || itemCodes.length === 0) return null;
  const parts = itemCodes
    .map((item) => {
      const code = item.code?.trim();
      const label = item.label?.trim();
      if (code && label) return `Item ${code} (${label})`;
      if (label) return label;
      if (code) return `Item ${code}`;
      return null;
    })
    .filter((p): p is string => Boolean(p))
    .slice(0, 3);
  if (parts.length === 0) return null;
  if (parts.length === 1) {
    return `The filing highlights ${parts[0]}.`;
  }
  const last = parts[parts.length - 1];
  return `The filing highlights ${parts.slice(0, -1).join(", ")} and ${last}.`;
}

function providerContextSentence(
  provider?: string | null,
  category?: string | null,
  subcategory?: string | null,
): string | null {
  switch (provider?.trim()) {
    case "sec-edgar":
      if (category === "insider") {
        const sub = subcategory?.trim();
        if (sub === "insider_buy") {
          return "This Form 4 filing reports insider share purchases — a signal traders watch for bullish conviction.";
        }
        if (sub === "insider_sell") {
          return "This Form 4 filing reports insider share sales — context for ownership changes, not always bearish.";
        }
        if (sub === "form4_mixed") {
          return "This Form 4 filing includes both insider buys and sells in the same report.";
        }
        return "Form 4 filings report insider buys, sells, or related equity changes.";
      }
      return "This is a current SEC disclosure traders watch for material company news.";
    case "nasdaq-halts":
      return "Exchange trading-halt events can pause liquidity until trading resumes.";
    case "polygon":
      return "This is market news coverage; open the original article for the full write-up.";
    case "finnhub":
      if (category === "earnings") {
        return "This is a scheduled earnings calendar entry with estimate or actual figures when available.";
      }
      if (category === "clinical" || category === "regulatory") {
        return "This is a biotech or regulatory calendar entry from Finnhub.";
      }
      if (category === "analyst") {
        return "This reflects analyst coverage — upgrades, downgrades, or recent price-target context.";
      }
      if (category === "capital") {
        return "This reflects capital-markets activity such as offerings or IPO calendar entries.";
      }
      return "This is a Finnhub catalyst calendar entry.";
    case "form4api":
      return "Form 4 filings report insider buys, sells, or related equity changes.";
    case "openfda":
      return "This reflects an FDA-side regulatory record.";
    case "clinicaltrials":
      return "This reflects a ClinicalTrials.gov study update.";
    default:
      return null;
  }
}

function rawDetailSentence(
  provider: string | null | undefined,
  rawContent: unknown,
): string | null {
  const raw = asRecord(rawContent);
  if (!raw) return null;

  switch (provider?.trim()) {
    case "nasdaq-halts": {
      const reason =
        stringField(raw, "description", "summary") || stringField(raw, "title");
      if (!reason) return null;
      // Avoid repeating a one-word title.
      if (reason.length < 24) return null;
      return `Exchange detail: ${extractiveSummary(reason, { maxSentences: 2, maxChars: 220 })}`;
    }
    case "finnhub": {
      const bits = joinFields([
        stringField(raw, "indication"),
        stringField(raw, "status"),
        stringField(raw, "catalyst"),
        raw.epsEstimate != null && raw.epsEstimate !== ""
          ? `EPS estimate ${String(raw.epsEstimate)}`
          : null,
        raw.epsActual != null && raw.epsActual !== ""
          ? `EPS actual ${String(raw.epsActual)}`
          : null,
        raw.revenueEstimate != null && raw.revenueEstimate !== ""
          ? `Revenue estimate ${String(raw.revenueEstimate)}`
          : null,
        raw.revenueActual != null && raw.revenueActual !== ""
          ? `Revenue actual ${String(raw.revenueActual)}`
          : null,
      ]);
      return bits ? `Key figures: ${bits}.` : null;
    }
    case "polygon": {
      const desc = stringField(raw, "description", "summary");
      if (!desc || desc.length < 40) return null;
      return extractiveSummary(desc, { maxSentences: 2, maxChars: 280 });
    }
    case "sec-edgar": {
      const atom = stringField(raw, "summary", "description");
      if (!atom || atom.length < 40) return null;
      // Prefer plain language over dumping raw Item legalese twice.
      if (/^item\s+\d+\.\d+/i.test(atom) && atom.length < 120) return null;
      return extractiveSummary(atom, { maxSentences: 2, maxChars: 260 });
    }
    default:
      return null;
  }
}

/**
 * Build 2–4 plain-language sentences from catalyst metadata when vendor text
 * is missing or too opaque for a trader to understand at a glance.
 */
export function synthesizeReadableSummary(input: ArticleSummaryInput): string {
  const subject = subjectPhrase(input);
  const event = eventPhrase(input);
  const cat = categoryLabel(input.eventCategory);
  const sentences: string[] = [];

  const subcategory = input.subcategory?.trim()?.replace(/_/g, " ") || null;
  const provider = input.provider?.trim() || null;

  if (
    isEarningsCatalyst({
      eventCategory: input.eventCategory,
      subcategory: input.subcategory,
      type: input.type,
      headline: input.headline,
      title: input.title,
      provider: input.provider,
      itemCodes: input.itemCodes,
    })
  ) {
    const figures = parseEarningsFromRaw(input.rawContent);
    if (figures) {
      sentences.push(
        buildEarningsIntro(figures, {
          symbol: input.symbol,
          companyName: input.companyName,
        }),
      );
    } else {
      sentences.push(`${subject} has an earnings-related catalyst: ${event}.`);
    }
  } else if (provider === "nasdaq-halts") {
    const haltVerb = /resum/i.test(event)
      ? "trading resumed after a halt"
      : /halt/i.test(event)
        ? "was placed under a trading halt"
        : "has an exchange trading-halt update";
    sentences.push(`${subject} ${haltVerb} on Nasdaq.`);
    if (subcategory && !/halt/i.test(event)) {
      sentences.push(`Status: ${subcategory}.`);
    }
  } else if (provider === "sec-edgar") {
    const form = input.type?.trim() || "SEC filing";
    const formArticle = /^[aeiou0-9]/i.test(form) ? "an" : "a";
    sentences.push(
      `${subject} filed ${formArticle} ${form} covering ${event.toLowerCase()}.`,
    );
  } else if (provider === "polygon") {
    sentences.push(`${subject} appears in market news: ${event}.`);
  } else if (provider === "finnhub") {
    const catLower = cat?.toLowerCase() || "scheduled";
    const article = /^[aeiou]/i.test(catLower) ? "an" : "a";
    sentences.push(`${subject} has ${article} ${catLower} catalyst: ${event}.`);
  } else {
    sentences.push(`${subject} — ${event}.`);
  }

  const items = itemSentence(input.itemCodes);
  if (items) sentences.push(items);

  const detail = rawDetailSentence(provider, input.rawContent);
  if (detail && !sentences.some((s) => s.includes(detail.slice(0, 40)))) {
    // Avoid duplicating EPS/revenue lines already covered by earnings intro.
    const earningsAlready =
      isEarningsCatalyst({
        eventCategory: input.eventCategory,
        subcategory: input.subcategory,
        type: input.type,
        headline: input.headline,
        title: input.title,
        provider: input.provider,
        itemCodes: input.itemCodes,
      }) && /Key figures:/i.test(detail);
    if (!earningsAlready) {
      sentences.push(detail.endsWith(".") ? detail : `${detail}.`);
    }
  }

  const context = providerContextSentence(
    provider,
    input.eventCategory as EventCategoryKey | null,
    input.subcategory,
  );
  if (context) sentences.push(context);

  // Cap at 4 sentences for scanability.
  const out = sentences.slice(0, 4).join(" ").replace(/\s+/g, " ").trim();
  return out;
}

/**
 * Prefer a substantial stored catalyst.summary; otherwise extract from body
 * or synthesize plain-language text from symbol / category / items / raw.
 */
export function resolveArticleSummary(
  input: ArticleSummaryInput,
): ArticleSummaryResult {
  const stored = input.summary?.trim() ? stripHtml(input.summary) : "";
  if (!isWeakSummary(stored)) {
    return { summary: extractiveSummary(stored), generated: false };
  }

  const body = input.body?.trim() ? stripHtml(input.body) : "";
  if (!isWeakSummary(body) && body !== stored) {
    return { summary: extractiveSummary(body), generated: true };
  }

  const synthesized = synthesizeReadableSummary({
    ...input,
    body: body || stored || input.body,
  });
  if (synthesized) {
    return { summary: synthesized, generated: true };
  }

  if (stored) {
    return { summary: stored, generated: false };
  }

  const fallback = joinFields([input.headline, input.title], " — ") || "";
  if (!fallback) {
    return { summary: "", generated: true };
  }
  return {
    summary: extractiveSummary(fallback, { maxSentences: 2, maxChars: 280 }),
    generated: true,
  };
}

/** Secondary CTA label for the vendor original URL. */
export function originalSourceLabel(provider?: string | null): string {
  switch (provider?.trim()) {
    case "sec-edgar":
      return "Original on SEC EDGAR";
    case "nasdaq-halts":
      return "Original on Nasdaq";
    case "polygon":
      return "Original article";
    case "macro-calendar":
      return "Official release calendar";
    case "finnhub":
      return "Original on source";
    case "openfda":
      return "Original on openFDA";
    case "clinicaltrials":
      return "Original on ClinicalTrials.gov";
    case "form4api":
      return "Original Form 4";
    default:
      return "View original source";
  }
}

/**
 * Ensure ingest rows get a usable summary when the vendor only supplied a title.
 * Safe to call during normalize → insert.
 */
export function ensureIngestSummary(input: {
  summary?: string | null;
  title: string;
  headline?: string | null;
  provider?: string | null;
  rawContent?: unknown;
  symbol?: string | null;
  companyName?: string | null;
  eventCategory?: string | null;
  subcategory?: string | null;
  type?: string | null;
  itemCodes?: SummaryItemCode[] | null;
}): string | null {
  const body = extractArticleBody({
    provider: input.provider,
    rawContent: input.rawContent,
    summary: input.summary,
    title: input.title,
    headline: input.headline,
  }).body;
  const resolved = resolveArticleSummary({
    summary: input.summary,
    title: input.title,
    headline: input.headline,
    body,
    symbol: input.symbol,
    companyName: input.companyName,
    eventCategory: input.eventCategory,
    subcategory: input.subcategory,
    type: input.type,
    itemCodes: input.itemCodes,
    provider: input.provider,
    rawContent: input.rawContent,
  });
  return resolved.summary || null;
}
