import {
  CATEGORY_LABELS,
  normalizeItemCodes,
  type EventCategoryKey,
  type ParsedItem,
} from "@/lib/jobs/parse-8k-items";
import { normalizeMaterialityReasons } from "@/lib/catalysts/materiality-reasons";
import { normalizeToGicsLabel } from "@/lib/companies/gics-sectors";
import type { AiLean } from "@/db/schema";

const AI_LEAN_SET = new Set<AiLean>([
  "bullish",
  "bearish",
  "neutral",
  "uncertain",
]);

/** A single catalyst as consumed by the Live feed UI. */
export interface FeedCatalyst {
  id: number;
  symbol: string | null;
  companyName: string | null;
  type: string;
  title: string;
  headline: string | null;
  eventCategory: EventCategoryKey | null;
  subcategory: string | null;
  items: ParsedItem[];
  /**
   * When the event occurred / was filed / published / is scheduled
   * (`catalysts.timestamp`). Never DB `createdAt` — that is ingest metadata.
   */
  timestamp: string;
  summary: string | null;
  impactScore: number | null;
  confidence: number | null;
  tags: string[];
  historicalImpact: unknown | null;
  /** Plain-language reasons behind impactScore (rule-based). */
  materialityReasons: string[];
  /** Shared on-demand AI triage; null until someone runs Analyze. */
  aiBullets: string[] | null;
  aiLean: AiLean | null;
  aiUncertain: boolean | null;
  sourceUrl: string | null;
  /** raw_sources.provider, e.g. "sec-edgar". */
  sourceProvider: string | null;
  /** companies.sector when the catalyst is linked to a company row. */
  sector: string | null;
  /** Structured investor facts for split triage (from SEC extract etc.). */
  keyFacts: { label: string; value: string }[];
}

/** Newest event time first; tie-break by higher id. */
export function compareFeedNewestFirst(
  a: { timestamp: string; id: number },
  b: { timestamp: string; id: number },
): number {
  const ta = Date.parse(a.timestamp);
  const tb = Date.parse(b.timestamp);
  const na = Number.isFinite(ta) ? ta : 0;
  const nb = Number.isFinite(tb) ? tb : 0;
  return nb - na || b.id - a.id;
}

/** Stable tape order: newest → oldest by `timestamp`. */
export function sortFeedNewestFirst<
  T extends { timestamp: string; id: number },
>(rows: readonly T[]): T[] {
  return [...rows].sort(compareFeedNewestFirst);
}

/** Shape shared by the DB row and the JSON API response before normalization. */
export interface RawCatalystRow {
  id: number;
  symbol: string | null;
  companyName?: string | null;
  type: string;
  title: string;
  headline?: string | null;
  eventCategory?: string | null;
  subcategory?: string | null;
  itemCodes?: unknown;
  timestamp: string;
  summary: string | null;
  impactScore: number | null;
  confidence?: number | null;
  tags?: unknown;
  historicalImpact?: unknown;
  materialityReasons?: unknown;
  aiBullets?: unknown;
  aiLean?: string | null;
  aiUncertain?: boolean | null;
  sourceUrl: string | null;
  sourceProvider?: string | null;
  sector?: string | null;
  /** Optional raw_sources.raw_content for keyFacts extraction. */
  rawContent?: unknown;
  /** Pre-extracted keyFacts (public API already computed these). */
  keyFacts?: { label: string; value: string }[];
}

function toEventCategory(
  value: string | null | undefined,
): EventCategoryKey | null {
  if (value && value in CATEGORY_LABELS) {
    return value as EventCategoryKey;
  }
  return null;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (t): t is string => typeof t === "string" && t.trim().length > 0,
  );
}

function normalizeAiBullets(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const bullets = value
    .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
    .map((b) => b.trim())
    .slice(0, 3);
  return bullets.length > 0 ? bullets : null;
}

function normalizeAiLean(value: string | null | undefined): AiLean | null {
  if (!value || !AI_LEAN_SET.has(value as AiLean)) return null;
  return value as AiLean;
}

function normalizeKeyFacts(
  rawContent: unknown,
): { label: string; value: string }[] {
  if (
    !rawContent ||
    typeof rawContent !== "object" ||
    Array.isArray(rawContent)
  ) {
    return [];
  }
  const extracted = (rawContent as Record<string, unknown>).extracted;
  if (!extracted || typeof extracted !== "object" || Array.isArray(extracted)) {
    return [];
  }
  const facts = (extracted as Record<string, unknown>).keyFacts;
  if (!Array.isArray(facts)) return [];
  const out: { label: string; value: string }[] = [];
  for (const fact of facts) {
    if (!fact || typeof fact !== "object") continue;
    const rec = fact as Record<string, unknown>;
    const label = typeof rec.label === "string" ? rec.label.trim() : "";
    const value = typeof rec.value === "string" ? rec.value.trim() : "";
    if (!label || !value) continue;
    out.push({ label, value });
    if (out.length >= 6) break;
  }
  return out;
}

/**
 * Normalizes an untrusted catalyst row (DB json / API payload) into a typed
 * {@link FeedCatalyst}, validating the `itemCodes` and `eventCategory` fields.
 *
 * @param row - Raw row from Drizzle or the `/api/catalysts` response.
 * @returns A fully-typed feed catalyst safe for rendering.
 */
export function toFeedCatalyst(row: RawCatalystRow): FeedCatalyst {
  return {
    id: row.id,
    symbol: row.symbol,
    companyName: row.companyName ?? null,
    type: row.type,
    title: row.title,
    headline: row.headline ?? null,
    eventCategory: toEventCategory(row.eventCategory),
    subcategory: row.subcategory?.trim() || null,
    items: normalizeItemCodes(row.itemCodes),
    timestamp: row.timestamp,
    summary: row.summary,
    impactScore: row.impactScore,
    confidence:
      typeof row.confidence === "number" && Number.isFinite(row.confidence)
        ? row.confidence
        : null,
    tags: normalizeTags(row.tags),
    historicalImpact: row.historicalImpact ?? null,
    materialityReasons: normalizeMaterialityReasons(row.materialityReasons),
    aiBullets: normalizeAiBullets(row.aiBullets),
    aiLean: normalizeAiLean(row.aiLean),
    aiUncertain: typeof row.aiUncertain === "boolean" ? row.aiUncertain : null,
    sourceUrl: row.sourceUrl,
    sourceProvider: row.sourceProvider ?? null,
    sector: normalizeToGicsLabel(row.sector) ?? row.sector ?? null,
    keyFacts:
      Array.isArray(row.keyFacts) && row.keyFacts.length > 0
        ? row.keyFacts
            .filter((f): f is { label: string; value: string } =>
              Boolean(
                f &&
                typeof f === "object" &&
                typeof f.label === "string" &&
                typeof f.value === "string" &&
                f.label.trim() &&
                f.value.trim(),
              ),
            )
            .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
            .slice(0, 6)
        : normalizeKeyFacts(row.rawContent),
  };
}
