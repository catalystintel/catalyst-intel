import { purgeStaleCatalysts } from "@/lib/jobs/data-retention";
import { fetchClinicalTrials } from "@/lib/jobs/fetch-clinicaltrials";
import { fetchFinnhubCatalysts } from "@/lib/jobs/fetch-finnhub-catalysts";
import { fetchForm4Api } from "@/lib/jobs/fetch-form4api";
import { listLaterSourceStubs } from "@/lib/jobs/fetch-later-stubs";
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
}

async function runSource(id: CatalystSourceId): Promise<SourceFetchResult> {
  switch (id) {
    case "sec-edgar": {
      try {
        // Defer retention to fetchAllCatalystSources so parallel keyless
        // inserts (openFDA, etc.) are not wiped mid-orchestrator run.
        const result = await fetchSecEdgar({ mode: "primary", purge: false });
        return toSourceResult("sec-edgar", result);
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
    case "form4api":
      return fetchForm4Api();
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

    // Sequential (Polygon news → prices)
    for (const id of phase.sources) {
      try {
        byId.set(id, await runSource(id));
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

  return {
    ranAt: new Date().toISOString(),
    fetchOrder: buildFetchOrder(),
    phases,
    sources,
    totals,
  };
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
