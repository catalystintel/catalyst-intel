/**
 * Catalyst ingest source ids + documented fetch order.
 * Safe to import from client components (no Node-only deps).
 *
 * Result / Admin display order follows CATALYST_SOURCE_IDS.
 * Runtime uses FETCH_PHASES (phased parallel) — see FETCH-ORDER.md.
 */

export const CATALYST_SOURCE_IDS = [
  "sec-edgar",
  "nasdaq-halts",
  "finnhub",
  "openfda",
  "clinicaltrials",
  "polygon-news",
  "polygon-prices",
  "form4api",
] as const;

export type CatalystSourceId = (typeof CATALYST_SOURCE_IDS)[number];

export type FetchPriority = "must" | "should";

export type FetchPhaseId = "A" | "B" | "C";

export interface CatalystSourceMeta {
  id: CatalystSourceId;
  /** 1-based display / Must→Should rank */
  order: number;
  label: string;
  priority: FetchPriority;
  phase: FetchPhaseId;
  /** Short operator-facing description of what this source contributes */
  contributes: string;
  keyEnv?: string;
}

/** Must→Should catalog — order matches CATALYST_SOURCE_IDS. */
export const CATALYST_SOURCE_CATALOG: readonly CatalystSourceMeta[] = [
  {
    id: "sec-edgar",
    order: 1,
    label: "SEC EDGAR",
    priority: "must",
    phase: "A",
    contributes:
      "8-K / Form 4 / S-3 / 424B / SC 13D·G filings (keyless; needs SEC_EDGAR_USER_AGENT)",
    keyEnv: "SEC_EDGAR_USER_AGENT",
  },
  {
    id: "nasdaq-halts",
    order: 2,
    label: "Nasdaq Halts",
    priority: "must",
    phase: "A",
    contributes: "Trading halt / resume events from Nasdaq (keyless)",
  },
  {
    id: "finnhub",
    order: 3,
    label: "Finnhub",
    priority: "should",
    phase: "B",
    contributes:
      "Earnings calendar, FDA calendar, company news (needs FINNHUB_API_KEY)",
    keyEnv: "FINNHUB_API_KEY",
  },
  {
    id: "openfda",
    order: 4,
    label: "openFDA",
    priority: "must",
    phase: "A",
    contributes: "Recent FDA drug approval (AP) submissions (keyless)",
  },
  {
    id: "clinicaltrials",
    order: 5,
    label: "ClinicalTrials.gov",
    priority: "must",
    phase: "A",
    contributes: "Recent clinical trial study updates (keyless)",
  },
  {
    id: "polygon-news",
    order: 6,
    label: "Polygon news",
    priority: "should",
    phase: "C",
    contributes:
      "Market/Benzinga-style news via Polygon/Massive (needs POLYGON_API_KEY)",
    keyEnv: "POLYGON_API_KEY",
  },
  {
    id: "polygon-prices",
    order: 7,
    label: "Polygon prices",
    priority: "should",
    phase: "C",
    contributes:
      "historical_impact enrichment from daily aggs (after news; free tier ~5 req/min)",
    keyEnv: "POLYGON_API_KEY",
  },
  {
    id: "form4api",
    order: 8,
    label: "Form4API",
    priority: "should",
    phase: "B",
    contributes:
      "Optional Form 4 enrichment (EDGAR Form 4 still works without FORM4_API_KEY)",
    keyEnv: "FORM4_API_KEY",
  },
] as const;

export interface FetchPhaseDef {
  id: FetchPhaseId;
  label: string;
  /** parallel within the phase, or sequential (Polygon news → prices) */
  mode: "parallel" | "sequential";
  sources: readonly CatalystSourceId[];
}

/**
 * Runtime phases for fetchAllCatalystSources:
 * - A: keyless Must sources in parallel
 * - B: optional-key Should sources in parallel (Finnhub, Form4API)
 * - C: Polygon news then prices (sequential; shared free-tier budget)
 */
export const FETCH_PHASES: readonly FetchPhaseDef[] = [
  {
    id: "A",
    label: "Keyless (parallel)",
    mode: "parallel",
    sources: ["sec-edgar", "nasdaq-halts", "openfda", "clinicaltrials"],
  },
  {
    id: "B",
    label: "Optional keys (parallel)",
    mode: "parallel",
    sources: ["finnhub", "form4api"],
  },
  {
    id: "C",
    label: "Polygon (sequential)",
    mode: "sequential",
    sources: ["polygon-news", "polygon-prices"],
  },
] as const;

export function isCatalystSourceId(value: string): value is CatalystSourceId {
  return (CATALYST_SOURCE_IDS as readonly string[]).includes(value);
}

export function getCatalystSourceMeta(
  id: CatalystSourceId,
): CatalystSourceMeta | undefined {
  return CATALYST_SOURCE_CATALOG.find((s) => s.id === id);
}
