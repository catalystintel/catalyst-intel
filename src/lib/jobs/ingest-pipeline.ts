import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { catalysts, companies, rawSources } from "@/db/schema";
import { scoreFromCategory } from "@/lib/catalysts/materiality";
import {
  isEventCategoryKey,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";
import type { ParsedItem } from "@/lib/jobs/parse-8k-items";

import { purgeStaleCatalysts } from "./data-retention";

/**
 * Vendor-agnostic catalyst ready for dedupe + insert.
 * Each source normalizes into this shape; the pipeline owns persistence.
 */
export interface NormalizedCatalyst {
  provider: string;
  externalId: string;
  url?: string | null;
  rawContent: unknown;
  ticker?: string | null;
  companyName?: string | null;
  type: string;
  title: string;
  headline?: string | null;
  eventCategory: EventCategoryKey;
  subcategory?: string | null;
  itemCodes?: ParsedItem[] | null;
  timestamp: string;
  summary?: string | null;
  impactScore?: number | null;
  confidence?: number | null;
  tags?: string[] | null;
  historicalImpact?: unknown | null;
}

export interface IngestPipelineResult {
  fetched: number;
  inserted: number;
  skipped: number;
  errors: number;
  ranAt: string;
  purgedCatalysts: number;
  purgedRawSources: number;
}

export interface SourceFetchResult extends IngestPipelineResult {
  source: string;
  configured: boolean;
  status: "ok" | "skipped" | "error";
  message?: string;
}

function normalizeTicker(ticker: string | null | undefined): string | null {
  const t = ticker?.trim().toUpperCase();
  return t || null;
}

async function resolveCompanyId(
  ticker: string | null,
  companyName: string | null | undefined,
): Promise<number | null> {
  if (!ticker) return null;

  const existing = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.ticker, ticker))
    .get();

  if (existing) return existing.id;

  const name = companyName?.trim() || ticker;
  const inserted = await db
    .insert(companies)
    .values({ name, ticker })
    .returning({ id: companies.id })
    .get();
  return inserted.id;
}

/**
 * Inserts normalized catalysts with externalId dedupe.
 * Safe to call from any source job or the multi-source orchestrator.
 */
export async function ingestNormalizedCatalysts(
  items: NormalizedCatalyst[],
  options?: { purge?: boolean },
): Promise<IngestPipelineResult> {
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of items) {
    try {
      if (!item.externalId || !item.provider || !item.type || !item.title) {
        errors++;
        continue;
      }

      const category = isEventCategoryKey(item.eventCategory)
        ? item.eventCategory
        : "other";

      const alreadyStored = await db
        .select({ id: rawSources.id })
        .from(rawSources)
        .where(eq(rawSources.externalId, item.externalId))
        .get();

      if (alreadyStored) {
        skipped++;
        continue;
      }

      const ticker = normalizeTicker(item.ticker);
      const companyName = item.companyName?.trim() || null;
      const timestamp = item.timestamp
        ? new Date(item.timestamp).toISOString()
        : new Date().toISOString();

      const rawRow = await db
        .insert(rawSources)
        .values({
          provider: item.provider,
          externalId: item.externalId,
          url: item.url ?? null,
          rawContent: item.rawContent ?? {},
        })
        .returning({ id: rawSources.id })
        .get();

      const companyId = await resolveCompanyId(ticker, companyName);
      const impactScore =
        typeof item.impactScore === "number"
          ? item.impactScore
          : scoreFromCategory(category);

      await db
        .insert(catalysts)
        .values({
          companyId,
          ticker,
          companyName,
          type: item.type,
          title: item.title,
          headline: item.headline ?? null,
          eventCategory: category,
          subcategory: item.subcategory ?? null,
          itemCodes: item.itemCodes ?? null,
          timestamp,
          rawSourceId: rawRow.id,
          summary: item.summary ?? null,
          impactScore,
          confidence: item.confidence ?? null,
          tags: item.tags ?? null,
          historicalImpact: item.historicalImpact ?? null,
        })
        .run();

      inserted++;
    } catch {
      errors++;
    }
  }

  let purgedCatalysts = 0;
  let purgedRawSources = 0;
  if (options?.purge !== false) {
    try {
      const retentionResult = await purgeStaleCatalysts();
      purgedCatalysts = retentionResult.deletedCatalysts;
      purgedRawSources = retentionResult.deletedRawSources;
    } catch (error) {
      console.error("Data retention purge failed:", error);
    }
  }

  return {
    fetched: items.length,
    inserted,
    skipped,
    errors,
    ranAt: new Date().toISOString(),
    purgedCatalysts,
    purgedRawSources,
  };
}

/** Soft-skip result when an optional API key is missing. */
export function skippedSourceResult(
  source: string,
  message: string,
): SourceFetchResult {
  return {
    source,
    configured: false,
    status: "skipped",
    message,
    fetched: 0,
    inserted: 0,
    skipped: 0,
    errors: 0,
    ranAt: new Date().toISOString(),
    purgedCatalysts: 0,
    purgedRawSources: 0,
  };
}

export function toSourceResult(
  source: string,
  result: IngestPipelineResult,
  configured = true,
): SourceFetchResult {
  return {
    source,
    configured,
    status: "ok",
    ...result,
  };
}
