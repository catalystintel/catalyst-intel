import {
  CATEGORY_LABELS,
  normalizeItemCodes,
  type EventCategoryKey,
  type ParsedItem,
} from "@/lib/jobs/parse-8k-items";

/** A single catalyst as consumed by the Live feed UI. */
export interface FeedCatalyst {
  id: number;
  ticker: string | null;
  companyName: string | null;
  type: string;
  title: string;
  headline: string | null;
  eventCategory: EventCategoryKey | null;
  items: ParsedItem[];
  timestamp: string;
  summary: string | null;
  impactScore: number | null;
  sourceUrl: string | null;
}

/** Shape shared by the DB row and the JSON API response before normalization. */
export interface RawCatalystRow {
  id: number;
  ticker: string | null;
  companyName?: string | null;
  type: string;
  title: string;
  headline?: string | null;
  eventCategory?: string | null;
  itemCodes?: unknown;
  timestamp: string;
  summary: string | null;
  impactScore: number | null;
  sourceUrl: string | null;
}

function toEventCategory(
  value: string | null | undefined,
): EventCategoryKey | null {
  if (value && value in CATEGORY_LABELS) {
    return value as EventCategoryKey;
  }
  return null;
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
    ticker: row.ticker,
    companyName: row.companyName ?? null,
    type: row.type,
    title: row.title,
    headline: row.headline ?? null,
    eventCategory: toEventCategory(row.eventCategory),
    items: normalizeItemCodes(row.itemCodes),
    timestamp: row.timestamp,
    summary: row.summary,
    impactScore: row.impactScore,
    sourceUrl: row.sourceUrl,
  };
}
