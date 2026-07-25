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
  "macro-calendar",
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
      "8-K (tradeable items) / Form 4 buy·sell / S-3 / 424B / 425 / SC 13D·G (keyless; needs SEC_EDGAR_USER_AGENT). Non-catalyst 8-K (7.01/8.01/9.01 + routine 1.04/5.05/5.07/5.08) and Form 4 awards/tax/gifts dropped.",
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
    id: "macro-calendar",
    order: 3,
    label: "Macro calendar",
    priority: "must",
    phase: "A",
    contributes:
      "CPI / NFP / FOMC dates for day traders (keyless; embedded BLS + Fed schedule)",
  },
  {
    id: "finnhub",
    order: 4,
    label: "Finnhub",
    priority: "should",
    phase: "B",
    contributes:
      "Near-term earnings + FDA + classified news + recent PT + IPO calendar + profile enrichment (needs FINNHUB_API_KEY). Consensus rec snapshots skipped.",
    keyEnv: "FINNHUB_API_KEY",
  },
  {
    id: "openfda",
    order: 5,
    label: "openFDA",
    priority: "must",
    phase: "A",
    contributes:
      "Recent FDA original (AP) approvals with sponsor→ticker resolution (keyless; unresolved dropped)",
  },
  {
    id: "clinicaltrials",
    order: 6,
    label: "ClinicalTrials.gov",
    priority: "must",
    phase: "A",
    contributes:
      "Material trial status changes (completed/terminated/suspended/withdrawn) with ticker (keyless; recruiting noise dropped)",
  },
  {
    id: "polygon-news",
    order: 7,
    label: "Polygon news",
    priority: "should",
    phase: "C",
    contributes:
      "Benzinga/wire + catalyst-classified articles only via Polygon/Massive (needs POLYGON_API_KEY). Generic news dropped.",
    keyEnv: "POLYGON_API_KEY",
  },
  {
    id: "polygon-prices",
    order: 8,
    label: "Polygon prices",
    priority: "should",
    phase: "C",
    contributes:
      "historical_impact + session_context enrichment from daily aggs (after news; free tier ~5 req/min)",
    keyEnv: "POLYGON_API_KEY",
  },
  {
    id: "form4api",
    order: 9,
    label: "Form4API",
    priority: "should",
    phase: "B",
    contributes:
      "Intentionally skipped (quality-first): duplicates SEC EDGAR Form 4 Atom",
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
    sources: [
      "sec-edgar",
      "nasdaq-halts",
      "macro-calendar",
      "openfda",
      "clinicaltrials",
    ],
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
