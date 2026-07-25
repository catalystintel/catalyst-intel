/**
 * Shared WHERE / facet helpers for `GET /api/catalysts`.
 * List rows and facet counts share the same predicates so search/counts
 * cover the full filtered corpus (not just the current page).
 */

import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db/client";
import { catalysts, companies, rawSources } from "@/db/schema";
import {
  GICS_SECTOR_KEYS,
  GICS_SECTOR_LABELS,
  isGicsSectorKey,
  normalizeToGics,
  type GicsSectorKey,
} from "@/lib/companies/gics-sectors";
import {
  formBucketFromType,
  isFeedFormFilter,
  type FeedFormFilter,
} from "@/lib/catalysts/feed-form-filters";
import type {
  FeedFacetBucket,
  FeedFacets,
} from "@/lib/catalysts/feed-query-types";
import {
  sinceIsoForFeedTimeWindow,
  type FeedTimeWindow,
} from "@/lib/catalysts/feed-time-window";
import {
  isEventCategoryKey,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";

export {
  FEED_FORM_FILTERS,
  FEED_FORM_LABELS,
  formBucketFromType,
  isFeedFormFilter,
  type FeedFormFilter,
} from "@/lib/catalysts/feed-form-filters";

export type { FeedFacetBucket, FeedFacets };

export const FEED_PAGE_SIZE = 75;
export const FEED_MAX_LIMIT = 200;

export interface FeedQueryFilters {
  q: string;
  categories: EventCategoryKey[];
  sectors: GicsSectorKey[];
  forms: FeedFormFilter[];
  sources: string[];
  timeWindow: FeedTimeWindow;
  /** ISO lower bound; overrides window when set. */
  since: string | null;
  /** Upper bound (now) — excludes future-dated calendar rows. */
  until: string;
}

export interface FeedCursor {
  timestamp: string;
  id: number;
}

export type FeedFacetAxis = "categories" | "sectors" | "forms" | "sources";

/** Reverse map: GICS key → strings that may appear in companies.sector. */
const SECTOR_SQL_ALIASES: Record<GicsSectorKey, string[]> = {
  energy: ["Energy", "Oil & Gas", "Oil and Gas"],
  materials: ["Materials", "Basic Materials", "Mining", "Chemicals"],
  industrials: ["Industrials", "Industrial", "Aerospace & Defense"],
  consumer_discretionary: [
    "Consumer Discretionary",
    "Consumer Cyclical",
    "Retail",
    "Automotive",
  ],
  consumer_staples: [
    "Consumer Staples",
    "Consumer Defensive",
    "Food & Beverage",
  ],
  health_care: [
    "Health Care",
    "Healthcare",
    "Biotechnology",
    "Pharmaceuticals",
    "Life Sciences",
  ],
  financials: [
    "Financials",
    "Financial",
    "Finance",
    "Banking",
    "Banks",
    "Insurance",
  ],
  information_technology: [
    "Information Technology",
    "Technology",
    "Tech",
    "Software",
    "Semiconductors",
  ],
  communication_services: [
    "Communication Services",
    "Media & Entertainment",
    "Telecom",
    "Telecommunications",
  ],
  utilities: ["Utilities"],
  real_estate: ["Real Estate", "REITs"],
};

export function sectorSqlValues(keys: GicsSectorKey[]): string[] {
  const values = new Set<string>();
  for (const key of keys) {
    values.add(GICS_SECTOR_LABELS[key]);
    for (const alias of SECTOR_SQL_ALIASES[key] ?? []) values.add(alias);
  }
  return [...values];
}

function formTypeSql(forms: FeedFormFilter[]): SQL | undefined {
  if (forms.length === 0) return undefined;
  const parts: SQL[] = [];
  for (const form of forms) {
    switch (form) {
      case "8-K":
        parts.push(
          or(
            like(catalysts.type, "8-K%"),
            eq(catalysts.type, "8K"),
            eq(catalysts.type, "8k"),
          )!,
        );
        break;
      case "424B":
        parts.push(like(catalysts.type, "424B%"));
        break;
      case "4":
        parts.push(or(eq(catalysts.type, "4"), like(catalysts.type, "4/%"))!);
        break;
      case "S-3":
        parts.push(like(catalysts.type, "S-3%"));
        break;
      case "13D":
        parts.push(like(catalysts.type, "%13D%"));
        break;
      case "13G":
        parts.push(like(catalysts.type, "%13G%"));
        break;
      case "other":
        parts.push(
          and(
            sql`${catalysts.type} NOT LIKE '8-K%'`,
            sql`${catalysts.type} NOT LIKE '424B%'`,
            sql`${catalysts.type} NOT LIKE 'S-3%'`,
            sql`${catalysts.type} NOT LIKE '%13D%'`,
            sql`${catalysts.type} NOT LIKE '%13G%'`,
            sql`${catalysts.type} NOT IN ('4', '8K', '8k')`,
            sql`${catalysts.type} NOT LIKE '4/%'`,
          )!,
        );
        break;
    }
  }
  return parts.length === 1 ? parts[0] : or(...parts);
}

function parseCsvParam(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseFeedQueryFromSearchParams(
  params: URLSearchParams,
  options?: { nowIso?: string },
): FeedQueryFilters {
  const timeWindowRaw = params.get("window") ?? "all";
  const timeWindow =
    timeWindowRaw === "recent" ||
    timeWindowRaw === "1h" ||
    timeWindowRaw === "4h" ||
    timeWindowRaw === "12h" ||
    timeWindowRaw === "24h" ||
    timeWindowRaw === "all"
      ? timeWindowRaw
      : "all";

  const sinceParam = params.get("since");
  let since: string | null = null;
  if (sinceParam) {
    const ms = Date.parse(sinceParam);
    if (!Number.isNaN(ms)) since = new Date(ms).toISOString();
  }
  if (!since) since = sinceIsoForFeedTimeWindow(timeWindow);

  const categories = parseCsvParam(params.get("categories")).filter(
    isEventCategoryKey,
  );
  const sectors = parseCsvParam(params.get("sectors")).filter(isGicsSectorKey);
  const forms = parseCsvParam(params.get("forms")).filter(isFeedFormFilter);
  const sources = parseCsvParam(params.get("sources")).map((s) =>
    s.toLowerCase(),
  );

  return {
    q: (params.get("q") ?? "").trim(),
    categories,
    sectors,
    forms,
    sources,
    timeWindow,
    since,
    until: options?.nowIso ?? new Date().toISOString(),
  };
}

export function parseFeedCursor(raw: string | null): FeedCursor | null {
  if (!raw?.trim()) return null;
  // Format: `${timestamp}|${id}` (timestamp is ISO, may contain `:`)
  const idx = raw.lastIndexOf("|");
  if (idx <= 0) return null;
  const timestamp = raw.slice(0, idx);
  const id = Number(raw.slice(idx + 1));
  if (!timestamp || !Number.isFinite(id) || id <= 0) return null;
  if (Number.isNaN(Date.parse(timestamp))) return null;
  return { timestamp, id: Math.floor(id) };
}

export function encodeFeedCursor(cursor: FeedCursor): string {
  return `${cursor.timestamp}|${cursor.id}`;
}

/**
 * Builds AND predicates for the feed. Pass `omit` to exclude one axis when
 * computing faceted counts (exclude-own-axis).
 */
export function buildFeedWhere(
  filters: FeedQueryFilters,
  options?: {
    omit?: FeedFacetAxis;
    cursor?: FeedCursor | null;
  },
): SQL | undefined {
  const parts: SQL[] = [lte(catalysts.timestamp, filters.until)];

  if (filters.since) {
    parts.push(gte(catalysts.timestamp, filters.since));
  }

  if (options?.cursor) {
    const { timestamp, id } = options.cursor;
    parts.push(
      sql`(${catalysts.timestamp} < ${timestamp} OR (${catalysts.timestamp} = ${timestamp} AND ${catalysts.id} < ${id}))`,
    );
  }

  const q = filters.q;
  if (q) {
    const pattern = `%${q.replace(/[%_]/g, "")}%`;
    parts.push(
      or(
        like(catalysts.ticker, pattern),
        like(catalysts.companyName, pattern),
        like(catalysts.title, pattern),
        like(catalysts.headline, pattern),
      )!,
    );
  }

  if (options?.omit !== "categories" && filters.categories.length > 0) {
    parts.push(inArray(catalysts.eventCategory, filters.categories));
  }

  if (options?.omit !== "sectors" && filters.sectors.length > 0) {
    const values = sectorSqlValues(filters.sectors);
    if (values.length > 0) {
      parts.push(inArray(companies.sector, values));
    }
  }

  if (options?.omit !== "forms" && filters.forms.length > 0) {
    const formSql = formTypeSql(filters.forms);
    if (formSql) parts.push(formSql);
  }

  if (options?.omit !== "sources" && filters.sources.length > 0) {
    parts.push(inArray(rawSources.provider, filters.sources));
  }

  return parts.length === 1 ? parts[0] : and(...parts);
}

export const feedSelectFields = {
  id: catalysts.id,
  ticker: catalysts.ticker,
  companyName: catalysts.companyName,
  type: catalysts.type,
  title: catalysts.title,
  headline: catalysts.headline,
  eventCategory: catalysts.eventCategory,
  subcategory: catalysts.subcategory,
  itemCodes: catalysts.itemCodes,
  timestamp: catalysts.timestamp,
  summary: catalysts.summary,
  impactScore: catalysts.impactScore,
  confidence: catalysts.confidence,
  tags: catalysts.tags,
  historicalImpact: catalysts.historicalImpact,
  materialityReasons: catalysts.materialityReasons,
  aiBullets: catalysts.aiBullets,
  aiLean: catalysts.aiLean,
  aiUncertain: catalysts.aiUncertain,
  sourceUrl: rawSources.url,
  sourceProvider: rawSources.provider,
  sector: companies.sector,
} as const;

export async function queryFeedPage(
  filters: FeedQueryFilters,
  options: { cursor?: FeedCursor | null; limit: number },
) {
  const where = buildFeedWhere(filters, { cursor: options.cursor });
  return db
    .select(feedSelectFields)
    .from(catalysts)
    .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
    .leftJoin(companies, eq(catalysts.companyId, companies.id))
    .where(where)
    .orderBy(desc(catalysts.timestamp), desc(catalysts.id))
    .limit(options.limit)
    .all();
}

export async function queryFeedTotal(
  filters: FeedQueryFilters,
): Promise<number> {
  const where = buildFeedWhere(filters);
  const row = await db
    .select({ value: count() })
    .from(catalysts)
    .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
    .leftJoin(companies, eq(catalysts.companyId, companies.id))
    .where(where)
    .get();
  return Number(row?.value ?? 0);
}

async function facetGroupBy(
  filters: FeedQueryFilters,
  omit: FeedFacetAxis,
  // Drizzle column or SQL expression used for GROUP BY / select key.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: any,
): Promise<FeedFacetBucket[]> {
  const where = buildFeedWhere(filters, { omit });
  const rows = await db
    .select({
      key: column,
      value: count(),
    })
    .from(catalysts)
    .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
    .leftJoin(companies, eq(catalysts.companyId, companies.id))
    .where(where)
    .groupBy(column)
    .all();

  return rows
    .map((r) => ({
      key: r.key == null || r.key === "" ? "unknown" : String(r.key),
      count: Number(r.value),
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/**
 * Facet counts with exclude-own-axis semantics so chips stay useful while
 * other filters are active.
 */
export async function queryFeedFacets(
  filters: FeedQueryFilters,
): Promise<FeedFacets> {
  const [categoryRows, sectorRows, sourceRows, typeRows] = await Promise.all([
    facetGroupBy(filters, "categories", catalysts.eventCategory),
    facetGroupBy(filters, "sectors", companies.sector),
    facetGroupBy(filters, "sources", rawSources.provider),
    facetGroupBy(filters, "forms", catalysts.type),
  ]);

  // Collapse raw types into form buckets; map sectors onto GICS keys.
  const formCounts = new Map<FeedFormFilter, number>();
  for (const row of typeRows) {
    if (row.key === "unknown") continue;
    const bucket = formBucketFromType(row.key);
    formCounts.set(bucket, (formCounts.get(bucket) ?? 0) + row.count);
  }

  const sectorCounts = new Map<string, number>();
  for (const row of sectorRows) {
    if (row.key === "unknown") continue;
    const gics = normalizeToGics(row.key);
    if (!gics) continue;
    sectorCounts.set(gics, (sectorCounts.get(gics) ?? 0) + row.count);
  }

  return {
    categories: categoryRows.filter(
      (r) => r.key !== "unknown" && isEventCategoryKey(r.key),
    ),
    sectors: [...sectorCounts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
    forms: [...formCounts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)),
    sources: sourceRows.filter((r) => r.key !== "unknown"),
  };
}

/** All GICS keys (for UI completeness when a sector has 0 in the window). */
export function allGicsSectorKeys(): readonly GicsSectorKey[] {
  return GICS_SECTOR_KEYS;
}
