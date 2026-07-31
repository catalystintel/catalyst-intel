/**
 * Benzinga-like article funnel helpers (IA only — keep B&W desk chrome).
 * Feed triage → Details depth: WIIM, takeaways, related symbols, Δ, thumb.
 */

import type { ArticleDetailCard } from "@/lib/catalysts/article-detail";
import {
  isAccNoMetadataBlob,
  stripHtml,
} from "@/lib/catalysts/article-content";

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z0-9"'(])/;
const SYMBOL_RE = /^[A-Z][A-Z0-9.]{0,9}$/;

/** Outcome / catalyst tokens to accent in body (word-level only). */
export const CATALYST_HIGHLIGHT_RE =
  /\b(beats?|misses?|raises?|raised|halts?|halted|approves?|approved|rejects?|rejected|resumes?|resumed)\b/gi;

export interface DeltaSincePublish {
  pctChange: number;
  date?: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeSymbol(value: string): string | null {
  const t = value.trim().toUpperCase().replace(/^\$/, "");
  if (!t || !SYMBOL_RE.test(t)) return null;
  // Filter common false positives from tags.
  if (
    t.length <= 1 ||
    [
      "SEC",
      "FDA",
      "IPO",
      "ETF",
      "CEO",
      "CFO",
      "USD",
      "EPS",
      "API",
      "USA",
      "NYSE",
      "AMEX",
      "BMO",
      "AMC",
      "NEWS",
      "HALT",
      "FORM",
      "ITEM",
      "NULL",
      "TRUE",
      "NADA",
      "TEST",
      "POLYGON",
      "BENZINGA",
      "FINNHUB",
      "OPENFDA",
      "EDGAR",
    ].includes(t)
  ) {
    return null;
  }
  return t;
}

/**
 * One-line “why it’s moving” from earnings intro, summary lead, or headline.
 * Optionally appends session Δ from Polygon historical_impact (WIIM-lite).
 */
export function deriveWhyMoving(input: {
  summary?: string | null;
  headline?: string | null;
  title?: string | null;
  detailCards?: ArticleDetailCard[];
  delta?: DeltaSincePublish | null;
}): string | null {
  const earnings = input.detailCards?.find((c) => c.kind === "earnings");
  let base: string | null = null;

  if (earnings?.intro?.trim()) {
    const intro = earnings.intro.trim();
    // Prefer a compact causality clause when long.
    if (intro.length <= 160) {
      base = intro;
    } else {
      const first = intro.split(SENTENCE_SPLIT)[0]?.trim();
      if (first)
        base = first.length > 180 ? `${first.slice(0, 177).trim()}…` : first;
    }
  }

  if (!base) {
    const summary = input.summary?.trim() ? stripHtml(input.summary) : "";
    if (summary) {
      const first = summary.split(SENTENCE_SPLIT)[0]?.trim();
      if (first && first.length >= 24) {
        base = first.length > 180 ? `${first.slice(0, 177).trim()}…` : first;
      }
    }
  }

  if (!base) {
    const headline = input.headline?.trim() ? stripHtml(input.headline) : "";
    const title = input.title?.trim() ? stripHtml(input.title) : "";
    const fallback = headline || title;
    if (!fallback || fallback.length < 12) return null;
    base =
      fallback.length > 180 ? `${fallback.slice(0, 177).trim()}…` : fallback;
  }

  const deltaBit = formatDeltaClause(input.delta);
  if (!deltaBit) return base;
  const combined = `${base.replace(/[.!?]?$/, "")}. ${deltaBit}`;
  return combined.length > 220 ? `${combined.slice(0, 217).trim()}…` : combined;
}

function formatDeltaClause(delta?: DeltaSincePublish | null): string | null {
  if (!delta || !Number.isFinite(delta.pctChange)) return null;
  const sign = delta.pctChange > 0 ? "+" : "";
  const pct = `${sign}${delta.pctChange.toFixed(1)}%`;
  const dateBit = delta.date ? ` (${delta.date})` : "";
  return `Session ${pct}${dateBit}`;
}

/**
 * Up to three short bullet takeaways from summary (then body).
 */
export function deriveTakeaways(
  summary?: string | null,
  body?: string | null,
  max = 3,
): string[] {
  const summaryClean = summary?.trim() ? stripHtml(summary) : "";
  const bodyClean = body?.trim() ? stripHtml(body) : "";
  const text =
    (summaryClean && !isAccNoLike(summaryClean) ? summaryClean : "") ||
    (bodyClean && !isAccNoLike(bodyClean) ? bodyClean : "");
  if (!text) return [];

  const sentences = text
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12)
    .filter((s) => !isAccNoLike(s));

  if (sentences.length >= 2) {
    return sentences
      .slice(0, max)
      .map((s) => (s.length > 160 ? `${s.slice(0, 157).trim()}…` : s));
  }

  // Weak sentence boundaries — split on · / ; or chunk the paragraph.
  const parts = text
    .split(/\s*[·;|]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 18)
    .filter((s) => !isAccNoLike(s));
  if (parts.length >= 2) {
    return parts
      .slice(0, max)
      .map((s) => (s.length > 160 ? `${s.slice(0, 157).trim()}…` : s));
  }

  if (text.length < 40) return isAccNoLike(text) ? [] : [text];

  const bullets: string[] = [];
  let rest = text;
  while (bullets.length < max && rest.length > 24) {
    const cutAt = Math.min(140, rest.length);
    let slice = rest.slice(0, cutAt);
    if (rest.length > cutAt) {
      const sp = slice.lastIndexOf(" ");
      if (sp > 40) slice = slice.slice(0, sp);
      bullets.push(`${slice.trim()}…`);
      rest = rest.slice(slice.length).trim();
    } else {
      bullets.push(slice.trim());
      break;
    }
  }
  return bullets.filter((b) => !isAccNoLike(b));
}

/** AccNo / Size Atom blobs are never useful takeaways. */
function isAccNoLike(text: string): boolean {
  return isAccNoMetadataBlob(text);
}

/**
 * Related symbols from Polygon/Benzinga-style raw payloads + symbol-like tags.
 */
export function extractRelatedSymbols(
  rawContent: unknown,
  primarySymbol?: string | null,
  tags?: string[] | null,
): string[] {
  const primary = primarySymbol?.trim().toUpperCase() || null;
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: string) => {
    const t = normalizeSymbol(raw);
    if (!t || t === primary || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  const root = asRecord(rawContent);
  if (root) {
    const lists = [
      root.symbols,
      root.stocks,
      root.symbols,
      root.relatedSymbols,
    ];
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const item of list) {
        if (typeof item === "string") {
          push(item);
          continue;
        }
        const rec = asRecord(item);
        if (!rec) continue;
        const sym =
          (typeof rec.symbol === "string" && rec.symbol) ||
          (typeof rec.symbol === "string" && rec.symbol) ||
          (typeof rec.name === "string" && rec.name) ||
          null;
        if (sym) push(sym);
      }
    }
  }

  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (typeof tag === "string") push(tag);
    }
  }

  return out.slice(0, 8);
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return /^https?:\/\//i.test(t) ? t : null;
}

/**
 * Optional source thumb when the vendor already stored an image URL.
 * Never invents media; skips favicons / site logos.
 */
export function extractArticleThumbUrl(rawContent: unknown): string | null {
  const root = asRecord(rawContent);
  if (!root) return null;

  const direct = [
    root.image_url,
    root.imageUrl,
    root.thumbnail,
    root.thumbnail_url,
    root.thumb,
    root.image,
    root.og_image,
    root.ogImage,
  ];
  for (const v of direct) {
    const url = httpsUrl(v);
    if (url) return url;
    const nested = asRecord(v);
    if (nested) {
      const nestedUrl = httpsUrl(nested.url) ?? httpsUrl(nested.href);
      if (nestedUrl) return nestedUrl;
    }
  }

  const images = asRecord(root.images);
  if (images) {
    for (const key of [
      "thumb",
      "small",
      "large",
      "url",
      "default",
      "original",
    ]) {
      const v = images[key];
      const url = httpsUrl(v);
      if (url) return url;
      const nested = asRecord(v);
      if (nested) {
        const nestedUrl = httpsUrl(nested.url) ?? httpsUrl(nested.href);
        if (nestedUrl) return nestedUrl;
      }
    }
  }

  return null;
}

/** Soft-parse session Δ from historical_impact JSON. */
export function parseDeltaSincePublish(
  historicalImpact: unknown,
): DeltaSincePublish | null {
  const rec = asRecord(historicalImpact);
  if (!rec) return null;
  const pct = rec.pctChange;
  if (typeof pct !== "number" || !Number.isFinite(pct)) return null;
  const date = typeof rec.date === "string" ? rec.date : null;
  return { pctChange: pct, date };
}

export type HighlightTone = "positive" | "negative" | "neutral";

export type HighlightSegment =
  | { type: "text"; value: string }
  | { type: "accent"; value: string; tone: HighlightTone };

function toneForMatch(word: string): HighlightTone {
  const w = word.toLowerCase();
  if (/^miss/.test(w) || /^reject/.test(w) || /^halt/.test(w))
    return "negative";
  if (
    /^beat/.test(w) ||
    /^rais/.test(w) ||
    /^approv/.test(w) ||
    /^resum/.test(w)
  ) {
    return "positive";
  }
  return "neutral";
}

/** Split plain text into segments with Beats/Misses (and key verbs) accented. */
export function segmentCatalystHighlights(text: string): HighlightSegment[] {
  if (!text) return [];
  const segments: HighlightSegment[] = [];
  const re = new RegExp(CATALYST_HIGHLIGHT_RE.source, "gi");
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: "text", value: text.slice(last, match.index) });
    }
    segments.push({
      type: "accent",
      value: match[0],
      tone: toneForMatch(match[0]),
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ type: "text", value: text.slice(last) });
  }
  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}

/** Highlight only beat/miss words inside a short Detail field value. */
export function segmentBeatMissWords(text: string): HighlightSegment[] {
  if (!text) return [];
  const re = /\b(Beat|Miss|Beats|Misses|In line)\b/gi;
  const segments: HighlightSegment[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: "text", value: text.slice(last, match.index) });
    }
    const word = match[0];
    const lower = word.toLowerCase();
    const tone: HighlightTone = lower.startsWith("miss")
      ? "negative"
      : lower.startsWith("beat")
        ? "positive"
        : "neutral";
    segments.push({ type: "accent", value: word, tone });
    last = match.index + word.length;
  }
  if (last < text.length) {
    segments.push({ type: "text", value: text.slice(last) });
  }
  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}
