import { createHash } from "node:crypto";

import type { EventCategoryKey } from "@/lib/catalysts/taxonomy";
import type { SentimentLean } from "@/db/schema";
import { categorizeNewsHeadline } from "@/lib/catalysts/news-category";
import {
  ingestNormalizedCatalysts,
  toSourceResult,
  type NormalizedCatalyst,
  type SourceFetchResult,
} from "@/lib/jobs/ingest-pipeline";
import {
  sanitizePrWireImageUrl,
  sanitizePrWirePublisher,
  sanitizePrWireText,
} from "@/lib/jobs/sanitize-pr-wire";
import { getPrWireApiBase, getPrWireApiKey } from "@/lib/jobs/vendor-env";
import { getVendorFetchState } from "@/lib/jobs/vendor-fetch-state";

/**
 * Public (keyless) scrape origin for the delayed high-impact wire board.
 * Server-only; never surfaced in product UI or persisted raw rows.
 *
 * Free board constraints (verified against live API):
 * - `min_score` is hard-fixed at 70 upstream (query params cannot lower it).
 * - ~60 minute delay (`delay_minutes`).
 * - Receipt rows have **no** article permalink / body — only scored metadata.
 * - Full `/a/{id}` bodies require the authenticated feed (`PR_WIRE_API_*`).
 */
const PUBLIC_WIRE_ORIGIN = "https://api.rtpr.io";

/** Authenticated firehose page size (API max 500). */
const AUTH_FEED_PAGE_LIMIT = 100;
/** Max authenticated pages per tick (newest-first cursor). */
const AUTH_FEED_MAX_PAGES = 5;

/**
 * Walk UTC days from today backward until this many consecutive empty days.
 * Prefer newest data; do not pin a fixed “N days ago” window.
 */
const PUBLIC_EMPTY_DAY_STOP = 2;
/** Safety cap so a broken upstream cannot loop forever. */
const PUBLIC_MAX_LOOKBACK_DAYS = 7;
/** Overlap behind watermark so delayed board updates are not missed. */
const PUBLIC_WATERMARK_OVERLAP_MS = 3 * 60 * 60 * 1000;

export class PrWireHttpError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(path: string, status: number, body: string, statusText: string) {
    super(
      `PR wire ${path} failed (${status}): ${body.slice(0, 200) || statusText}`,
    );
    this.name = "PrWireHttpError";
    this.status = status;
    this.body = body;
  }
}

export function isPrWireRateLimitError(error: unknown): boolean {
  return error instanceof PrWireHttpError && error.status === 429;
}

/** In-memory wire article before sanitize → NormalizedCatalyst. */
export interface PrWireArticle {
  id?: string;
  ticker?: string;
  tickers?: string[];
  title?: string;
  author?: string;
  created?: string;
  article_published_at?: string;
  article_body?: string;
  exchange?: string;
  /** Ephemeral fetch URL — never persisted. */
  article_url?: string;
  image_url?: string;
  imageUrl?: string;
  thumbnail?: string;
  impactScore?: number | null;
  sentiment?: SentimentLean | null;
  eventType?: string | null;
  eventLabel?: string | null;
  /** Public-board theme slug (e.g. biotech_catalyst) — product-safe. */
  theme?: string | null;
  tier?: string | null;
  /** Settled session move % from the public board (when available). */
  realizedMovePct?: number | null;
  realizedMaxAbs?: number | null;
  settled?: boolean | null;
  /**
   * Structured extract for Details/split when body is receipt-synthesized
   * (free board) or after scraping an authenticated `/a/{id}` page.
   */
  extracted?: {
    investorSummary?: string;
    keyFacts?: { label: string; value: string }[];
    bodySnippets?: string[];
  } | null;
}

/** Public high-impact receipt row (keyless board). */
export interface PrWirePublicReceipt {
  ticker?: string;
  score?: number;
  tier?: string;
  direction?: string;
  event_type?: string;
  event_label?: string;
  scored_at?: string;
  title?: string;
  theme?: string | null;
  realized_move_pct?: number | null;
  realized_max_abs?: number | null;
  settled?: boolean | null;
}

interface PrWireFeedRef {
  ticker?: string;
  article_published_at?: string;
  article_url?: string;
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
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Opaque stable id — never store upstream permalink paths. */
export function opaquePrWireId(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

/** Resolve a raw article key from id or ephemeral permalink path. */
export function prWireArticleId(
  article: Pick<PrWireArticle, "id" | "article_url">,
): string | null {
  const direct = article.id?.trim();
  if (direct) return opaquePrWireId(direct);
  const url = article.article_url?.trim();
  if (!url) return null;
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\/a\/([^/?#]+)/i);
    if (m?.[1]?.trim()) return opaquePrWireId(m[1].trim());
  } catch {
    const m = url.match(/\/a\/([^/?#]+)/i);
    if (m?.[1]?.trim()) return opaquePrWireId(m[1].trim());
  }
  return opaquePrWireId(url);
}

export const prWirePublisherLabel = sanitizePrWirePublisher;

/**
 * Observed public-board event_type values (n≈100 sample, Jul 27–31 2026) mapped
 * into desk taxonomy. Unknown types fall through to headline classifier.
 */
const EVENT_TYPE_CATEGORY: Record<string, EventCategoryKey> = {
  financing_offering: "capital",
  reverse_split: "capital",
  merger_acquisition: "deals",
  contract_award: "deals",
  partnership: "deals",
  product_launch: "other",
  clinical_trial_results: "clinical",
  fda_approval: "regulatory",
  fda_rejection: "regulatory",
  regulatory_action: "regulatory",
  earnings: "earnings",
  earnings_beat: "earnings",
  earnings_miss: "earnings",
};

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Humanize theme/event slugs for summary lines (no vendor jargon). */
export function humanizeWireSlug(
  slug: string | null | undefined,
): string | null {
  const raw = slug?.trim();
  if (!raw) return null;
  return raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Investor-facing summary from public receipt fields (no article body on free board). */
export function buildPublicReceiptSummary(input: {
  eventLabel?: string | null;
  theme?: string | null;
  impactScore?: number | null;
  direction?: string | null;
  realizedMovePct?: number | null;
  settled?: boolean | null;
  title?: string | null;
}): string {
  const parts: string[] = [];
  const title = input.title?.trim();
  if (title) parts.push(title);
  const label = input.eventLabel?.trim();
  if (label) parts.push(label);
  const theme = humanizeWireSlug(input.theme);
  if (theme) parts.push(`${theme} theme`);
  if (typeof input.impactScore === "number") {
    parts.push(`Impact score ${input.impactScore}`);
  }
  const direction = input.direction?.trim();
  if (direction) parts.push(`${direction} lean`);
  if (
    input.settled &&
    typeof input.realizedMovePct === "number" &&
    Number.isFinite(input.realizedMovePct)
  ) {
    const sign = input.realizedMovePct > 0 ? "+" : "";
    parts.push(
      `Session move ${sign}${input.realizedMovePct.toFixed(2)}% (settled)`,
    );
  } else if (input.settled === false) {
    parts.push("Session move pending");
  }
  return parts.join(" · ");
}

/** Structured extract for split/details when the free board has no article body. */
export function buildPublicReceiptExtract(input: {
  eventLabel?: string | null;
  theme?: string | null;
  impactScore?: number | null;
  direction?: string | null;
  tier?: string | null;
  realizedMovePct?: number | null;
  realizedMaxAbs?: number | null;
  settled?: boolean | null;
  title?: string | null;
}): {
  investorSummary: string;
  keyFacts: { label: string; value: string }[];
  bodySnippets: string[];
} {
  const keyFacts: { label: string; value: string }[] = [];
  const label = input.eventLabel?.trim();
  if (label) keyFacts.push({ label: "Event", value: label });
  const theme = humanizeWireSlug(input.theme);
  if (theme) keyFacts.push({ label: "Theme", value: theme });
  if (typeof input.impactScore === "number") {
    keyFacts.push({ label: "Impact score", value: String(input.impactScore) });
  }
  if (input.tier?.trim()) {
    keyFacts.push({ label: "Tier", value: input.tier.trim() });
  }
  if (input.direction?.trim()) {
    keyFacts.push({ label: "Lean", value: input.direction.trim() });
  }
  if (
    input.settled &&
    typeof input.realizedMovePct === "number" &&
    Number.isFinite(input.realizedMovePct)
  ) {
    const sign = input.realizedMovePct > 0 ? "+" : "";
    keyFacts.push({
      label: "Session move",
      value: `${sign}${input.realizedMovePct.toFixed(2)}%`,
    });
  } else if (input.settled === false) {
    keyFacts.push({ label: "Session move", value: "Pending" });
  }
  if (
    typeof input.realizedMaxAbs === "number" &&
    Number.isFinite(input.realizedMaxAbs)
  ) {
    keyFacts.push({
      label: "Max |move|",
      value: `${input.realizedMaxAbs.toFixed(2)}%`,
    });
  }

  const investorSummary = buildPublicReceiptSummary(input);
  const bodySnippets = keyFacts
    .slice(0, 6)
    .map((f) => `${f.label}: ${f.value}`);
  return { investorSummary, keyFacts, bodySnippets };
}

/** Map settled public-board move into desk historicalImpact JSON. */
export function publicReceiptHistoricalImpact(article: {
  realizedMovePct?: number | null;
  realizedMaxAbs?: number | null;
  settled?: boolean | null;
  article_published_at?: string;
  created?: string;
}): Record<string, unknown> | null {
  if (!article.settled) return null;
  const pct = finiteNumber(article.realizedMovePct);
  if (pct === null) return null;
  const ts =
    article.article_published_at?.trim() || article.created?.trim() || null;
  const date = ts && !Number.isNaN(Date.parse(ts)) ? ts.slice(0, 10) : null;
  const maxAbs = finiteNumber(article.realizedMaxAbs);
  return {
    // No vendor `provider` key — product APIs scrub origins.
    status: "settled",
    pctChange: Number(pct.toFixed(3)),
    maxAbs: maxAbs === null ? null : Number(maxAbs.toFixed(3)),
    date,
    asOf: new Date().toISOString(),
  };
}

export function mapPublicEventCategory(
  eventType: string | null | undefined,
  title: string,
): { eventCategory: EventCategoryKey; subcategory: string } {
  const key = eventType?.trim().toLowerCase() || "";
  if (key && EVENT_TYPE_CATEGORY[key]) {
    return { eventCategory: EVENT_TYPE_CATEGORY[key], subcategory: key };
  }
  const classified = categorizeNewsHeadline(title);
  return {
    eventCategory: classified.eventCategory,
    subcategory: classified.subcategory || "press_release",
  };
}

export function mapPublicDirection(
  direction: string | null | undefined,
): SentimentLean | null {
  const d = direction?.trim().toLowerCase();
  if (d === "bullish" || d === "bearish" || d === "neutral") return d;
  return null;
}

/** Map a keyless public receipt into a PrWireArticle. */
export function publicReceiptToArticle(
  receipt: PrWirePublicReceipt,
): PrWireArticle | null {
  const ticker = receipt.ticker?.trim().toUpperCase();
  const title = receipt.title?.trim();
  const scoredAt = receipt.scored_at?.trim();
  if (!ticker || !title || !scoredAt) return null;
  const impactScore =
    typeof receipt.score === "number" && Number.isFinite(receipt.score)
      ? Math.max(0, Math.min(100, Math.round(receipt.score)))
      : null;
  const realizedMovePct = finiteNumber(receipt.realized_move_pct);
  const realizedMaxAbs = finiteNumber(receipt.realized_max_abs);
  const settled = typeof receipt.settled === "boolean" ? receipt.settled : null;
  const theme = receipt.theme?.trim() || null;
  const eventLabel = receipt.event_label?.trim() || null;
  const direction = receipt.direction?.trim() || null;
  const tier = receipt.tier?.trim() || null;
  const extractInput = {
    eventLabel,
    theme,
    impactScore,
    direction,
    tier,
    realizedMovePct,
    realizedMaxAbs,
    settled,
    title,
  };
  return {
    id: `${ticker}|${scoredAt}|${title}`,
    ticker,
    tickers: [ticker],
    title,
    author: undefined,
    created: scoredAt,
    article_published_at: scoredAt,
    impactScore,
    sentiment: mapPublicDirection(direction),
    eventType: receipt.event_type ?? null,
    eventLabel,
    theme,
    tier,
    realizedMovePct,
    realizedMaxAbs,
    settled,
    article_body: buildPublicReceiptSummary(extractInput),
    extracted: buildPublicReceiptExtract(extractInput),
  };
}

/**
 * Map a wire article into a sanitized NormalizedCatalyst.
 * Persists only product-safe fields — no upstream URLs, HTML, or brand traces.
 */
export function articleToNormalized(
  article: PrWireArticle,
): NormalizedCatalyst | null {
  const id = prWireArticleId(article);
  const title = sanitizePrWireText(article.title);
  if (!id || !title) return null;

  const symbols = [
    ...(article.ticker ? [article.ticker] : []),
    ...(article.tickers ?? []),
  ]
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  const symbol = symbols[0] ?? null;
  const publisher = sanitizePrWirePublisher(article.author);
  const timestampRaw =
    article.article_published_at?.trim() || article.created?.trim();
  const timestamp = timestampRaw
    ? new Date(timestampRaw).toISOString()
    : new Date().toISOString();
  if (Number.isNaN(Date.parse(timestamp))) return null;

  const mapped = mapPublicEventCategory(article.eventType, title);
  const body = sanitizePrWireText(article.article_body);
  const summary = body
    ? body.length > 420
      ? `${body.slice(0, 417).trim()}…`
      : body
    : null;

  const imageUrl = sanitizePrWireImageUrl(
    article.image_url || article.imageUrl || article.thumbnail,
  );

  const exchange = sanitizePrWireText(article.exchange);
  const eventLabel = sanitizePrWireText(article.eventLabel);
  const theme = sanitizePrWireText(article.theme);
  const historicalImpact = publicReceiptHistoricalImpact(article);

  // Prefer hydrate extract; otherwise build snippets from the full body.
  const extracted =
    article.extracted ??
    (body
      ? {
          investorSummary:
            body.length > 420 ? `${body.slice(0, 417).trim()}…` : body,
          bodySnippets: body
            .split(/(?<=[.!?])\s+/)
            .map((s) => s.trim())
            .filter((s) => s.length >= 40)
            .slice(0, 8),
          keyFacts: title ? [{ label: "Headline", value: title }] : [],
        }
      : null);

  const rawContent: Record<string, unknown> = {
    id,
    ticker: symbol,
    tickers: symbols,
    title,
    created: timestamp,
    article_body: body,
    exchange,
    eventType: article.eventType ?? null,
    eventLabel,
    theme,
    tier: article.tier ?? null,
    settled: article.settled ?? null,
  };
  // Never persist author / publisherName / wireSource — origin leak.
  if (publisher) rawContent.byline = publisher;
  if (imageUrl) rawContent.image_url = imageUrl;
  if (typeof article.impactScore === "number") {
    rawContent.impactScore = article.impactScore;
  }
  if (typeof article.realizedMovePct === "number") {
    rawContent.realizedMovePct = article.realizedMovePct;
  }
  if (typeof article.realizedMaxAbs === "number") {
    rawContent.realizedMaxAbs = article.realizedMaxAbs;
  }
  if (extracted) {
    rawContent.extracted = {
      investorSummary: sanitizePrWireText(extracted.investorSummary),
      keyFacts: (extracted.keyFacts ?? [])
        .map((f) => ({
          label: sanitizePrWireText(f.label) ?? "",
          value: sanitizePrWireText(f.value) ?? "",
        }))
        .filter((f) => f.label && f.value)
        .slice(0, 8),
      bodySnippets: (extracted.bodySnippets ?? [])
        .map((s) => sanitizePrWireText(s))
        .filter((s): s is string => Boolean(s))
        .slice(0, 8),
    };
  }

  const confidence =
    article.settled &&
    typeof article.realizedMovePct === "number" &&
    Math.abs(article.realizedMovePct) >= 5
      ? 88
      : body && body.length >= 280
        ? 82
        : 78;

  return {
    provider: "pr-wire",
    externalId: `pr-wire:${id}`,
    url: null,
    rawContent,
    symbol,
    companyName: symbol,
    type: "Press Release",
    title,
    headline: eventLabel || null,
    eventCategory: mapped.eventCategory,
    subcategory: mapped.subcategory || "press_release",
    timestamp,
    summary,
    confidence,
    impactScore: article.impactScore ?? null,
    sentiment: article.sentiment ?? null,
    historicalImpact,
    tags: [
      ...(article.eventType ? [article.eventType] : []),
      ...(theme ? [theme] : []),
      ...symbols.slice(0, 3),
    ],
  };
}

function utcDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchJson(
  url: string,
  options?: { apiKey?: string; pathLabel?: string },
): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "CatalystIntel/0.1",
  };
  if (options?.apiKey) {
    headers.Authorization = `Bearer ${options.apiKey}`;
  }

  const res = await fetch(url, {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new PrWireHttpError(
      options?.pathLabel ?? "request",
      res.status,
      body,
      res.statusText,
    );
  }

  return res.json();
}

/**
 * Keyless public board — delayed high-impact press receipts (no API key).
 * Walks UTC days from today backward (newest first) until consecutive empty
 * days. Optional watermark keeps steady-state ticks focused on recent scores.
 */
export async function fetchPublicImpactReceipts(options?: {
  now?: Date;
  /** Max receipts after merge/sort (default 500 — board is sparse). */
  limit?: number;
  /** Max UTC days to walk backward from today (default PUBLIC_MAX_LOOKBACK_DAYS). */
  maxLookbackDays?: number;
  /** ISO watermark — keep receipts at/after watermark − overlap. */
  sinceIso?: string | null;
}): Promise<PrWireArticle[]> {
  const now = options?.now ?? new Date();
  const maxTotal = Math.min(500, Math.max(1, options?.limit ?? 500));
  const maxDays = Math.min(
    PUBLIC_MAX_LOOKBACK_DAYS,
    Math.max(1, options?.maxLookbackDays ?? PUBLIC_MAX_LOOKBACK_DAYS),
  );
  const sinceMs = options?.sinceIso ? Date.parse(options.sinceIso) : NaN;
  const floorMs = Number.isFinite(sinceMs)
    ? sinceMs - PUBLIC_WATERMARK_OVERLAP_MS
    : null;

  const byKey = new Map<string, PrWireArticle>();
  let emptyStreak = 0;

  for (let i = 0; i < maxDays; i++) {
    const day = utcDayString(new Date(now.getTime() - i * 86_400_000));
    const url = `${PUBLIC_WIRE_ORIGIN}/public/impact-receipts?day=${encodeURIComponent(day)}&limit=100`;
    const payload = await fetchJson(url, {
      pathLabel: "public-receipts",
    });
    const root = asRecord(payload);
    const list = Array.isArray(root?.receipts) ? root.receipts : [];
    if (list.length === 0) {
      emptyStreak++;
      if (emptyStreak >= PUBLIC_EMPTY_DAY_STOP && byKey.size > 0) break;
      continue;
    }
    emptyStreak = 0;

    for (const item of list) {
      const rec = asRecord(item);
      if (!rec) continue;
      const article = publicReceiptToArticle({
        ticker: stringField(rec, "ticker") ?? undefined,
        score: typeof rec.score === "number" ? rec.score : undefined,
        tier: stringField(rec, "tier") ?? undefined,
        direction: stringField(rec, "direction") ?? undefined,
        event_type: stringField(rec, "event_type") ?? undefined,
        event_label: stringField(rec, "event_label") ?? undefined,
        scored_at: stringField(rec, "scored_at") ?? undefined,
        title: stringField(rec, "title") ?? undefined,
        theme: stringField(rec, "theme"),
        realized_move_pct: finiteNumber(rec.realized_move_pct),
        realized_max_abs: finiteNumber(rec.realized_max_abs),
        settled: typeof rec.settled === "boolean" ? rec.settled : null,
      });
      if (!article?.id) continue;
      if (floorMs !== null) {
        const ts =
          Date.parse(article.article_published_at || article.created || "") ||
          0;
        if (ts < floorMs) continue;
      }
      byKey.set(article.id, article);
    }
  }

  return [...byKey.values()]
    .sort((a, b) => {
      const ta = Date.parse(a.article_published_at || a.created || "") || 0;
      const tb = Date.parse(b.article_published_at || b.created || "") || 0;
      return tb - ta;
    })
    .slice(0, maxTotal);
}

/**
 * Follow an authenticated `/a/{id}` (or HTML) permalink and pull the full
 * article body for Details. Brand/host traces are stripped at normalize time.
 */
async function hydrateArticleFromUrl(
  articleUrl: string,
  apiKey: string,
): Promise<PrWireArticle | null> {
  const res = await fetch(articleUrl, {
    headers: {
      Accept: "application/json, text/html;q=0.8",
      Authorization: `Bearer ${apiKey}`,
      "X-API-Key": apiKey,
      "User-Agent": "CatalystIntel/0.1",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new PrWireHttpError("article", res.status, body, res.statusText);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = (await res.json()) as unknown;
    const root = asRecord(data);
    const nested = asRecord(root?.data) ?? asRecord(root?.article) ?? root;
    if (!nested) return null;
    const articleBody =
      stringField(nested, "article_body", "body", "content") ?? undefined;
    const title = stringField(nested, "title") ?? undefined;
    return {
      id: stringField(nested, "id") ?? undefined,
      ticker: stringField(nested, "ticker") ?? undefined,
      tickers: Array.isArray(nested.tickers)
        ? nested.tickers.filter((t): t is string => typeof t === "string")
        : undefined,
      title,
      // Wire-house author never persisted.
      author: undefined,
      created:
        stringField(nested, "created", "article_published_at") ?? undefined,
      article_published_at:
        stringField(nested, "article_published_at", "created") ?? undefined,
      article_body: articleBody,
      exchange: stringField(nested, "exchange") ?? undefined,
      article_url: articleUrl,
      image_url:
        stringField(nested, "image_url", "imageUrl", "thumbnail") ?? undefined,
      extracted: articleBody
        ? {
            investorSummary:
              articleBody.length > 420
                ? `${articleBody.slice(0, 417).trim()}…`
                : articleBody,
            bodySnippets: articleBody
              .split(/(?<=[.!?])\s+/)
              .map((s) => s.trim())
              .filter((s) => s.length >= 40)
              .slice(0, 8),
            keyFacts: title ? [{ label: "Headline", value: title }] : undefined,
          }
        : null,
    };
  }

  const html = await res.text();
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.replace(/\s*\|\s*.*$/, "").trim();
  if (!title) return null;
  const plain = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16_000);
  return {
    id: prWireArticleId({ article_url: articleUrl }) ?? undefined,
    title,
    article_body: plain,
    article_url: articleUrl,
    extracted: {
      investorSummary:
        plain.length > 420 ? `${plain.slice(0, 417).trim()}…` : plain,
      bodySnippets: plain
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 40)
        .slice(0, 6),
      keyFacts: [{ label: "Headline", value: title }],
    },
  };
}

function parseFullArticlesPayload(payload: unknown): PrWireArticle[] {
  const root = asRecord(payload);
  const list = Array.isArray(root?.articles)
    ? root.articles
    : Array.isArray(payload)
      ? payload
      : [];
  return list
    .map((item) => asRecord(item))
    .filter((r): r is Record<string, unknown> => r !== null)
    .map((r) => ({
      id: stringField(r, "id") ?? undefined,
      ticker: stringField(r, "ticker") ?? undefined,
      tickers: Array.isArray(r.tickers)
        ? r.tickers.filter((t): t is string => typeof t === "string")
        : undefined,
      title: stringField(r, "title") ?? undefined,
      author: stringField(r, "author") ?? undefined,
      created: stringField(r, "created", "article_published_at") ?? undefined,
      article_published_at:
        stringField(r, "article_published_at", "created") ?? undefined,
      article_body: stringField(r, "article_body", "body") ?? undefined,
      exchange: stringField(r, "exchange") ?? undefined,
      article_url: stringField(r, "article_url", "url") ?? undefined,
      image_url:
        stringField(r, "image_url", "imageUrl", "thumbnail") ?? undefined,
    }));
}

function parseFeedRefs(payload: unknown): PrWireFeedRef[] {
  const root = asRecord(payload);
  const list = Array.isArray(root?.articles) ? root.articles : [];
  return list
    .map((item) => asRecord(item))
    .filter((r): r is Record<string, unknown> => r !== null)
    .map((r) => ({
      ticker: stringField(r, "ticker") ?? undefined,
      article_published_at:
        stringField(r, "article_published_at", "created") ?? undefined,
      article_url: stringField(r, "article_url", "url") ?? undefined,
    }))
    .filter((r) => Boolean(r.article_url));
}

function buildBodyExtract(
  body: string,
  title?: string | null,
): NonNullable<PrWireArticle["extracted"]> {
  return {
    investorSummary: body.length > 420 ? `${body.slice(0, 417).trim()}…` : body,
    bodySnippets: body
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 40)
      .slice(0, 8),
    keyFacts: title?.trim()
      ? [{ label: "Headline", value: title.trim() }]
      : undefined,
  };
}

/**
 * Authenticated firehose when PR_WIRE_API_KEY + BASE are set.
 * Prefer `/articles` (includes `article_body` per OpenAPI) so Details get the
 * full press text. Fall back to body-free `/feed/articles` + `/a/{id}` hydrate.
 */
async function fetchAuthenticatedArticles(
  baseUrl: string,
  apiKey: string,
  options?: { maxArticles?: number },
): Promise<PrWireArticle[]> {
  const maxArticles = Math.min(
    500,
    Math.max(
      1,
      options?.maxArticles ?? AUTH_FEED_PAGE_LIMIT * AUTH_FEED_MAX_PAGES,
    ),
  );

  // Prefer full-payload /articles — bodies included; richest Details content.
  try {
    const collected: PrWireArticle[] = [];
    let nextToken: string | null = null;
    for (let page = 0; page < AUTH_FEED_MAX_PAGES; page++) {
      const qs = new URLSearchParams({
        limit: String(Math.min(AUTH_FEED_PAGE_LIMIT, maxArticles)),
      });
      if (nextToken) qs.set("next_token", nextToken);
      const fullPayload = await fetchJson(
        `${baseUrl}/articles?${qs.toString()}`,
        { apiKey, pathLabel: "/articles" },
      );
      const articles = parseFullArticlesPayload(fullPayload);
      const root = asRecord(fullPayload);
      nextToken =
        typeof root?.next_token === "string" && root.next_token.trim()
          ? root.next_token.trim()
          : null;

      for (const article of articles) {
        if (collected.length >= maxArticles) break;
        if (article.article_body?.trim()) {
          collected.push({
            ...article,
            // Author is a wire-house brand — drop before normalize.
            author: undefined,
            extracted: buildBodyExtract(article.article_body, article.title),
          });
          continue;
        }
        if (!article.article_url) {
          collected.push({ ...article, author: undefined });
          continue;
        }
        try {
          const full = await hydrateArticleFromUrl(article.article_url, apiKey);
          collected.push({
            ...article,
            ...full,
            author: undefined,
            ticker: full?.ticker ?? article.ticker,
            article_published_at:
              full?.article_published_at ?? article.article_published_at,
          });
        } catch (hydrateError) {
          if (isPrWireRateLimitError(hydrateError)) throw hydrateError;
          collected.push({ ...article, author: undefined });
        }
      }

      if (
        collected.length >= maxArticles ||
        !nextToken ||
        articles.length === 0
      ) {
        break;
      }
    }
    if (collected.length > 0) return collected;
  } catch (error) {
    if (!(error instanceof PrWireHttpError) || error.status !== 404) {
      throw error;
    }
  }

  // Fallback: body-free feed + hydrate each `/a/{id}` permalink.
  const hydrated: PrWireArticle[] = [];
  let nextToken: string | null = null;
  for (let page = 0; page < AUTH_FEED_MAX_PAGES; page++) {
    const qs = new URLSearchParams({
      limit: String(AUTH_FEED_PAGE_LIMIT),
    });
    if (nextToken) qs.set("next_token", nextToken);
    const feedPayload = await fetchJson(
      `${baseUrl}/feed/articles?${qs.toString()}`,
      { apiKey, pathLabel: "/feed/articles" },
    );
    const refs = parseFeedRefs(feedPayload);
    const root = asRecord(feedPayload);
    nextToken =
      typeof root?.next_token === "string" && root.next_token.trim()
        ? root.next_token.trim()
        : null;

    for (const ref of refs) {
      if (!ref.article_url) continue;
      if (hydrated.length >= maxArticles) break;
      try {
        const full = await hydrateArticleFromUrl(ref.article_url, apiKey);
        if (!full) continue;
        hydrated.push({
          ...full,
          author: undefined,
          ticker: full.ticker ?? ref.ticker,
          article_published_at:
            full.article_published_at ?? ref.article_published_at,
          // Ephemeral — used for hydrate id only; never persisted as url.
          article_url: ref.article_url,
        });
      } catch (hydrateError) {
        if (isPrWireRateLimitError(hydrateError)) throw hydrateError;
      }
    }

    if (hydrated.length >= maxArticles || !nextToken || refs.length === 0) {
      break;
    }
  }
  return hydrated;
}

/**
 * Fetch PR-wire catalysts.
 *
 * Default (no key): newest-first scrape of the public delayed impact board
 * (keyless; upstream floor score≥70; no article URLs). Optional env
 * credentials unlock `/articles` full bodies (preferred) or `/a/{id}` hydrate
 * for Details.
 */
export async function fetchPrWire(options?: {
  limit?: number;
}): Promise<SourceFetchResult> {
  const apiKey = getPrWireApiKey();
  const baseUrl = getPrWireApiBase();
  const authEnabled = Boolean(apiKey && baseUrl);

  try {
    let articles: PrWireArticle[] = [];
    let mode: "public" | "auth" = "public";

    if (authEnabled && apiKey && baseUrl) {
      mode = "auth";
      articles = await fetchAuthenticatedArticles(baseUrl, apiKey, {
        maxArticles: Math.min(500, Math.max(1, options?.limit ?? 200)),
      });
    } else {
      const state = await getVendorFetchState("pr-wire");
      articles = await fetchPublicImpactReceipts({
        limit: options?.limit ?? 500,
        sinceIso: state?.lastFetchedAt ?? null,
      });
    }

    const normalized = articles
      .map(articleToNormalized)
      .filter((n): n is NormalizedCatalyst => n !== null);

    const result = await ingestNormalizedCatalysts(normalized, {
      purge: false,
    });
    const sourceResult = toSourceResult("pr-wire", result);
    return {
      ...sourceResult,
      message:
        mode === "public"
          ? `Public impact board · ${normalized.length} newest receipts (delayed · score≥70 upstream).`
          : `Authenticated wire · ${normalized.length} articles (full bodies).`,
    };
  } catch (error) {
    if (isPrWireRateLimitError(error)) {
      return {
        source: "pr-wire",
        configured: true,
        status: "ok",
        rateLimited: true,
        message:
          "PR wire rate-limited this tick — watermark held; retry next cron.",
        fetched: 0,
        inserted: 0,
        skipped: 0,
        errors: 0,
        ranAt: new Date().toISOString(),
        purgedCatalysts: 0,
        purgedRawSources: 0,
      };
    }

    const rawMessage = error instanceof Error ? error.message : String(error);
    return {
      source: "pr-wire",
      configured: true,
      status: "error",
      message: sanitizePrWireText(rawMessage) ?? "PR wire fetch failed.",
      fetched: 0,
      inserted: 0,
      skipped: 0,
      errors: 1,
      ranAt: new Date().toISOString(),
      purgedCatalysts: 0,
      purgedRawSources: 0,
    };
  }
}
