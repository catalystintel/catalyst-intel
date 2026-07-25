import { and, eq, gte } from "drizzle-orm";

import { db } from "@/db/client";
import { catalysts, companies, rawSources } from "@/db/schema";
import type { SentimentLean, TickerSource } from "@/db/schema";
import { ensureIngestSummary } from "@/lib/catalysts/article-content";
import { computeMateriality } from "@/lib/catalysts/materiality";
import { evaluateCatalystQuality } from "@/lib/catalysts/quality-gate";
import {
  isEventCategoryKey,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";
import { classifySession } from "@/lib/alerts/session";
import type { ParsedItem } from "@/lib/jobs/parse-8k-items";
import {
  DEDUPE_WINDOW_MINUTES,
  shouldSkipAsDuplicate,
} from "@/lib/jobs/dedupe-catalysts";

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
  /** How `ticker` was resolved — see ticker-resolver.ts. Null = not applicable / vendor-native. */
  tickerSource?: TickerSource | null;
  sentiment?: SentimentLean | null;
  sentimentReasoning?: string | null;
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
  /**
   * Vendor HTTP 429 (or equivalent). Watermark must not advance — next tick
   * widens the fetch window (see vendor_fetch_state / polygon-news-window).
   */
  rateLimited?: boolean;
}

function normalizeTicker(ticker: string | null | undefined): string | null {
  const t = ticker?.trim().toUpperCase();
  return t || null;
}

async function resolveCompany(
  ticker: string | null,
  companyName: string | null | undefined,
): Promise<{ id: number | null; marketCapMillions: number | null }> {
  if (!ticker) return { id: null, marketCapMillions: null };

  const existing = await db
    .select({ id: companies.id, marketCap: companies.marketCap })
    .from(companies)
    .where(eq(companies.ticker, ticker))
    .get();

  if (existing) {
    return { id: existing.id, marketCapMillions: existing.marketCap };
  }

  const name = companyName?.trim() || ticker;
  const inserted = await db
    .insert(companies)
    .values({ name, ticker })
    .returning({ id: companies.id })
    .get();
  return { id: inserted.id, marketCapMillions: null };
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

      // Quality-first: drop firehose / boilerplate / unresolved orphans before
      // we burn a raw_sources row. Prefer less gold over spam volume.
      const gated = evaluateCatalystQuality({
        ...item,
        eventCategory: category,
      });
      if (gated.decision === "drop") {
        skipped++;
        continue;
      }

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

      // Cross-API near-dupe: same ticker + similar title in the window.
      // Prefer keeping the better source (SEC over wire retellings).
      if (ticker) {
        const since = new Date(
          Date.now() - DEDUPE_WINDOW_MINUTES * 60 * 1000,
        ).toISOString();
        const peers = await db
          .select({
            id: catalysts.id,
            title: catalysts.title,
            headline: catalysts.headline,
            provider: rawSources.provider,
            eventCategory: catalysts.eventCategory,
            timestamp: catalysts.timestamp,
            impactScore: catalysts.impactScore,
          })
          .from(catalysts)
          .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
          .where(
            and(eq(catalysts.ticker, ticker), gte(catalysts.timestamp, since)),
          )
          .all();

        const dupe = shouldSkipAsDuplicate(
          {
            ticker,
            title: item.title,
            headline: item.headline,
            provider: item.provider,
            eventCategory: category,
            timestamp,
          },
          peers.map((p) => ({
            id: p.id,
            title: p.title,
            headline: p.headline,
            provider: p.provider ?? "unknown",
            eventCategory: p.eventCategory,
            timestamp: p.timestamp,
            impactScore: p.impactScore,
          })),
        );
        if (dupe.skip) {
          skipped++;
          continue;
        }
      }

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

      const { id: companyId, marketCapMillions } = await resolveCompany(
        ticker,
        companyName,
      );

      let impactScore: number;
      let materialityReasons: string[] | null;
      if (typeof item.impactScore === "number") {
        impactScore = item.impactScore;
        materialityReasons = null;
      } else {
        const session = classifySession(timestamp);
        const computed = computeMateriality({
          eventCategory: category,
          itemCodes: item.itemCodes,
          marketCapMillions,
          session,
          sentiment: item.sentiment,
        });
        impactScore = computed.score;
        materialityReasons = computed.reasons;
      }

      const summary = ensureIngestSummary({
        summary: item.summary,
        title: item.title,
        headline: item.headline,
        provider: item.provider,
        rawContent: item.rawContent,
        ticker,
        companyName,
        eventCategory: category,
        subcategory: item.subcategory,
        type: item.type,
        itemCodes: item.itemCodes,
      });

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
          summary,
          impactScore,
          confidence: item.confidence ?? null,
          tags: item.tags ?? null,
          historicalImpact: item.historicalImpact ?? null,
          tickerSource: item.tickerSource ?? null,
          sentiment: item.sentiment ?? null,
          sentimentReasoning: item.sentimentReasoning ?? null,
          materialityReasons,
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
