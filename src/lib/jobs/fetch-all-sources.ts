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
  CATALYST_SOURCE_IDS,
  type CatalystSourceId,
} from "@/lib/jobs/catalyst-sources";

export {
  CATALYST_SOURCE_IDS,
  isCatalystSourceId,
  type CatalystSourceId,
} from "@/lib/jobs/catalyst-sources";

export interface FetchAllSourcesResult {
  ranAt: string;
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
        const result = await fetchSecEdgar({ mode: "primary" });
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

/**
 * Multi-source orchestrator: runs selected (or all) ingest jobs via
 * Promise.allSettled so one vendor outage never blocks the rest.
 */
export async function fetchAllCatalystSources(options?: {
  sources?: CatalystSourceId[];
  includeLaterStubs?: boolean;
}): Promise<FetchAllSourcesResult> {
  const selected = options?.sources?.length
    ? options.sources
    : [...CATALYST_SOURCE_IDS];

  const settled = await Promise.allSettled(selected.map((id) => runSource(id)));
  const sources = settled.map((result, i) =>
    settledToResult(selected[i], result),
  );

  if (options?.includeLaterStubs) {
    sources.push(...listLaterSourceStubs());
  }

  const totals = sources.reduce(
    (acc, s) => {
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
