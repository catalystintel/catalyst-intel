import { runAlertAutoFire } from "@/lib/alerts/auto-fire";
import { clusterRecentCatalysts } from "@/lib/jobs/cluster-events";
import { purgeStaleCatalysts } from "@/lib/jobs/data-retention";
import { fetchClinicalTrials } from "@/lib/jobs/fetch-clinicaltrials";
import { fetchFinnhubCatalysts } from "@/lib/jobs/fetch-finnhub-catalysts";
import { listLaterSourceStubs } from "@/lib/jobs/fetch-later-stubs";
import { fetchMacroCalendar } from "@/lib/jobs/fetch-macro-calendar";
import { fetchNasdaqHalts } from "@/lib/jobs/fetch-nasdaq-halts";
import { fetchOpenFda } from "@/lib/jobs/fetch-openfda";
import {
  enrichHistoricalImpact,
  fetchPolygonNews,
} from "@/lib/jobs/fetch-polygon";
import { fetchSecEdgar } from "@/lib/jobs/fetch-sec-edgar";
import type { SourceFetchResult } from "@/lib/jobs/ingest-pipeline";
import { toSourceResult } from "@/lib/jobs/ingest-pipeline";
import { formatSecFetchError } from "@/lib/jobs/sec-edgar-http";
import {
  CATALYST_SOURCE_CATALOG,
  CATALYST_SOURCE_IDS,
  FETCH_PHASES,
  type CatalystSourceId,
  type FetchPhaseDef,
  type FetchPhaseId,
} from "@/lib/jobs/catalyst-sources";
import { recordVendorFetchFromResult } from "@/lib/jobs/vendor-fetch-state";

export {
  CATALYST_SOURCE_CATALOG,
  CATALYST_SOURCE_IDS,
  FETCH_PHASES,
  getCatalystSourceMeta,
  isCatalystSourceId,
  type CatalystSourceId,
  type CatalystSourceMeta,
  type FetchPhaseDef,
  type FetchPhaseId,
  type FetchPriority,
} from "@/lib/jobs/catalyst-sources";

export interface FetchOrderEntry {
  order: number;
  id: CatalystSourceId;
  label: string;
  priority: "must" | "should";
  phase: FetchPhaseId;
  contributes: string;
}

export interface FetchPhasePlan {
  id: FetchPhaseId;
  label: string;
  mode: "parallel" | "sequential";
  sources: CatalystSourceId[];
}

export interface FetchAllSourcesResult {
  ranAt: string;
  /** Documented Must→Should display order (always full catalog order) */
  fetchOrder: FetchOrderEntry[];
  /** Phases that actually ran (subset when `sources` filter is set) */
  phases: FetchPhasePlan[];
  /** Per-source results in CATALYST_SOURCE_IDS / Must→Should order */
  sources: SourceFetchResult[];
  totals: {
    fetched: number;
    inserted: number;
    skipped: number;
    errors: number;
  };
  /**
   * Post-ingest enrichment that runs once per orchestrator call, across all
   * sources' output rather than per-source: cross-source clustering, LLM
   * triage batch, and auto-fired alerts. Never throws — soft-fails to zeroed
   * counts so a broken enrichment step can't take down ingestion itself.
   */
  enrichment: {
    clustersCreated: number;
    catalystsLinked: number;
    llmTriaged: number;
    llmSkipped: number;
    alertsEvaluated: number;
    alertsDelivered: number;
    alertsFailed: number;
  };
}

async function runSource(id: CatalystSourceId): Promise<SourceFetchResult> {
  let result: SourceFetchResult;
  try {
    result = await runSourceInner(id);
  } catch (error) {
    result = settledToResult(id, { status: "rejected", reason: error });
  }
  try {
    await recordVendorFetchFromResult({
      sourceId: id,
      status: result.status,
      message: result.message,
      rateLimited: result.rateLimited,
    });
  } catch {
    // Watermark write must never fail the ingest tick.
  }
  return result;
}

async function runSourceInner(
  id: CatalystSourceId,
): Promise<SourceFetchResult> {
  switch (id) {
    case "sec-edgar": {
      try {
        // Defer retention to fetchAllCatalystSources so parallel keyless
        // inserts (openFDA, etc.) are not wiped mid-orchestrator run.
        const result = await fetchSecEdgar({ mode: "primary", purge: false });
        const base = toSourceResult("sec-edgar", result);
        return result.message ? { ...base, message: result.message } : base;
      } catch (error) {
        return {
          source: "sec-edgar",
          configured: true,
          status: "error",
          message: formatSecFetchError(error),
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
    case "nasdaq-halts":
      return fetchNasdaqHalts();
    case "macro-calendar":
      return fetchMacroCalendar();
    case "finnhub":
      return fetchFinnhubCatalysts();
    case "polygon-news":
      return fetchPolygonNews();
    case "polygon-prices":
      return enrichHistoricalImpact();
    case "openfda":
      return fetchOpenFda();
    case "clinicaltrials":
      return fetchClinicalTrials();
    default: {
      const _exhaustive: never = id;
      return {
        source: String(_exhaustive),
        configured: false,
        status: "error",
        message: "Unknown source",
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
}

function settledToResult(
  id: string,
  settled: PromiseSettledResult<SourceFetchResult>,
): SourceFetchResult {
  if (settled.status === "fulfilled") return settled.value;
  const reason = settled.reason;
  return {
    source: id,
    configured: true,
    status: "error",
    message:
      reason instanceof Error ? reason.message : String(reason ?? "failed"),
    fetched: 0,
    inserted: 0,
    skipped: 0,
    errors: 1,
    ranAt: new Date().toISOString(),
    purgedCatalysts: 0,
    purgedRawSources: 0,
  };
}

function buildFetchOrder(): FetchOrderEntry[] {
  return CATALYST_SOURCE_CATALOG.map((s) => ({
    order: s.order,
    id: s.id,
    label: s.label,
    priority: s.priority,
    phase: s.phase,
    contributes: s.contributes,
  }));
}

function phasesForSelection(selected: CatalystSourceId[]): FetchPhasePlan[] {
  const selectedSet = new Set(selected);
  return FETCH_PHASES.map((phase: FetchPhaseDef) => ({
    id: phase.id,
    label: phase.label,
    mode: phase.mode,
    sources: phase.sources.filter((id) => selectedSet.has(id)),
  })).filter((phase) => phase.sources.length > 0);
}

/**
 * Multi-source orchestrator with documented phased parallel order:
 *
 * - Phase A — keyless Must sources in parallel (SEC, Nasdaq, openFDA, CT)
 * - Phase B — optional-key Should sources in parallel (Finnhub, Form4API)
 * - Phase C — Polygon news then prices sequentially (shared ~5 req/min budget)
 *
 * Per-source results are always returned in CATALYST_SOURCE_IDS (Must→Should)
 * display order. See FETCH-ORDER.md.
 */
export async function fetchAllCatalystSources(options?: {
  sources?: CatalystSourceId[];
  includeLaterStubs?: boolean;
}): Promise<FetchAllSourcesResult> {
  const runStartIso = new Date().toISOString();
  const selected = options?.sources?.length
    ? options.sources
    : [...CATALYST_SOURCE_IDS];
  const selectedSet = new Set(selected);
  const byId = new Map<string, SourceFetchResult>();
  const phases = phasesForSelection(selected);

  for (const phase of phases) {
    if (phase.mode === "parallel") {
      const settled = await Promise.allSettled(
        phase.sources.map((id) => runSource(id)),
      );
      for (let i = 0; i < phase.sources.length; i++) {
        byId.set(
          phase.sources[i],
          settledToResult(phase.sources[i], settled[i]),
        );
      }
      continue;
    }

    // Sequential (Polygon news → prices). Skip prices when news already burned
    // the shared free-tier budget so we don't stack another 429 in the same tick.
    let polygonNewsRateLimited = false;
    for (const id of phase.sources) {
      if (id === "polygon-prices" && polygonNewsRateLimited) {
        const deferred: SourceFetchResult = {
          source: "polygon-prices",
          configured: true,
          status: "ok",
          rateLimited: true,
          message:
            "Deferred this tick — polygon-news was rate-limited (shared ~5 req/min budget).",
          fetched: 0,
          inserted: 0,
          skipped: 0,
          errors: 0,
          ranAt: new Date().toISOString(),
          purgedCatalysts: 0,
          purgedRawSources: 0,
        };
        try {
          await recordVendorFetchFromResult({
            sourceId: id,
            status: deferred.status,
            message: deferred.message,
            rateLimited: true,
          });
        } catch {
          // ignore
        }
        byId.set(id, deferred);
        continue;
      }

      try {
        const result = await runSource(id);
        if (id === "polygon-news" && result.rateLimited) {
          polygonNewsRateLimited = true;
        }
        byId.set(id, result);
      } catch (error) {
        byId.set(
          id,
          settledToResult(id, { status: "rejected", reason: error }),
        );
      }
    }
  }

  // Preserve Must→Should display order from CATALYST_SOURCE_IDS.
  const sources = selected.map(
    (id) =>
      byId.get(id) ??
      settledToResult(id, {
        status: "rejected",
        reason: new Error("Source did not run"),
      }),
  );

  if (options?.includeLaterStubs) {
    sources.push(...listLaterSourceStubs());
  }

  // Single retention pass after all sources finish inserting.
  let purgedCatalysts = 0;
  let purgedRawSources = 0;
  try {
    const retention = await purgeStaleCatalysts();
    purgedCatalysts = retention.deletedCatalysts;
    purgedRawSources = retention.deletedRawSources;
  } catch (error) {
    console.error("Data retention purge failed:", error);
  }

  if (purgedCatalysts > 0 || purgedRawSources > 0) {
    const sec = sources.find((s) => s.source === "sec-edgar");
    if (sec) {
      sec.purgedCatalysts = purgedCatalysts;
      sec.purgedRawSources = purgedRawSources;
    }
  }

  const totals = sources.reduce(
    (acc, s) => {
      // Only count selected catalog sources toward totals (not later stubs)
      if (!selectedSet.has(s.source as CatalystSourceId)) return acc;
      acc.fetched += s.fetched;
      acc.inserted += s.inserted;
      acc.skipped += s.skipped;
      acc.errors += s.errors;
      return acc;
    },
    { fetched: 0, inserted: 0, skipped: 0, errors: 0 },
  );

  const enrichment = await runPostIngestEnrichment(runStartIso);

  return {
    ranAt: new Date().toISOString(),
    fetchOrder: buildFetchOrder(),
    phases,
    sources,
    totals,
    enrichment,
  };
}

/**
 * Cross-source enrichment that only makes sense after all sources for this
 * run have inserted: clustering (needs the full same-tick picture), LLM
 * triage batch, and auto-fired alerts (`since: runStartIso`). Each step is
 * independently soft-failed so one broken step never blocks the others or
 * the orchestrator's own result.
 */
async function runPostIngestEnrichment(
  runStartIso: string,
): Promise<FetchAllSourcesResult["enrichment"]> {
  const result: FetchAllSourcesResult["enrichment"] = {
    clustersCreated: 0,
    catalystsLinked: 0,
    llmTriaged: 0,
    llmSkipped: 0,
    alertsEvaluated: 0,
    alertsDelivered: 0,
    alertsFailed: 0,
  };

  try {
    const clustered = await clusterRecentCatalysts();
    result.clustersCreated = clustered.clustersCreated;
    result.catalystsLinked = clustered.catalystsLinked;
  } catch (error) {
    const { reportServerError } =
      await import("@/lib/observability/report-error");
    await reportServerError(error, { step: "event_clustering" });
  }

  // AI triage is on-demand only (POST /api/catalysts/[id]/analyze) so free
  // OpenRouter quota is spent when a trader actually opens an event — not on
  // every cron tick. llmTriaged / llmSkipped stay 0 in enrichment stats.

  try {
    const fired = await runAlertAutoFire({ since: runStartIso });
    result.alertsEvaluated = fired.evaluated;
    result.alertsDelivered = fired.delivered;
    result.alertsFailed = fired.failed;
  } catch (error) {
    const { reportServerError } =
      await import("@/lib/observability/report-error");
    await reportServerError(error, { step: "alert_auto_fire" });
  }

  return result;
}

export async function fetchCatalystSource(
  source: CatalystSourceId,
): Promise<SourceFetchResult> {
  try {
    return await runSource(source);
  } catch (error) {
    return settledToResult(source, {
      status: "rejected",
      reason: error,
    });
  }
}
