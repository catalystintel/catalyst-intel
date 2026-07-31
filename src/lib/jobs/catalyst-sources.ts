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
  "pr-wire",
  "finnhub",
  "openfda",
  "clinicaltrials",
  "polygon-news",
  "polygon-prices",
  "fmp-econ-calendar",
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
  /**
   * When false, orchestrator + per-source admin fetch soft-skip (code kept).
   * Default true when omitted.
   */
  fetchEnabled?: boolean;
  /**
   * When false, excluded from `fetch/all` / 1-min cron phases. Still
   * fetchable via `POST /api/admin/fetch/[source]` (dedicated cron).
   * Default true when omitted.
   */
  includeInFetchAll?: boolean;
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
      "8-K (tradeable items) / Form 4 buy·sell / S-3 / 424B / 425 / SC 13D·G (keyless; needs an SEC EDGAR User-Agent). Non-catalyst 8-K (7.01/8.01/9.01 + routine 1.04/5.05/5.07/5.08) and Form 4 awards/tax/gifts dropped.",
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
      "CPI / NFP / PPI / FOMC dates for day traders (keyless; embedded BLS + Fed schedule)",
  },
  {
    id: "pr-wire",
    order: 4,
    label: "PR wire",
    priority: "must",
    phase: "B",
    contributes:
      "Press releases from major PR wires. Keyless public impact board by default (newest-first; ~60m delay; upstream score≥70 floor — cannot lower on free API; no article URLs). Structured extract for Details. Optional authenticated PR wire credentials unlock the full firehose + article body scrape (all scores).",
  },
  {
    id: "finnhub",
    order: 5,
    label: "Finnhub",
    priority: "should",
    phase: "B",
    contributes:
      "Near-term earnings + FDA + classified news + recent PT + IPO calendar + profile enrichment (needs Finnhub credentials). Consensus rec snapshots skipped.",
    keyEnv: "FINNHUB_API_KEY",
  },
  {
    id: "openfda",
    order: 6,
    label: "openFDA",
    priority: "must",
    phase: "A",
    contributes:
      "Recent FDA original (AP) approvals with sponsor→symbol resolution (keyless; unresolved dropped)",
  },
  {
    id: "clinicaltrials",
    order: 7,
    label: "ClinicalTrials.gov",
    priority: "must",
    phase: "A",
    // Paused: CT.gov API refreshes ~daily (hours of lag) — not act-faster.
    fetchEnabled: false,
    contributes:
      "PAUSED — not fetched (daily API refresh ≈ hours lag). Code kept. Material trial status changes when re-enabled.",
  },
  {
    id: "polygon-news",
    order: 8,
    label: "Polygon news",
    priority: "should",
    phase: "C",
    // Paused: /v2/reference/news is ~hourly, not real-time Benzinga wire.
    fetchEnabled: false,
    contributes:
      "PAUSED — not fetched (Ticker News ≈ hourly; not RT Benzinga). Code kept. Re-enable only with real-time news entitlement.",
    keyEnv: "POLYGON_API_KEY",
  },
  {
    id: "polygon-prices",
    order: 9,
    label: "Polygon prices",
    priority: "should",
    phase: "C",
    contributes:
      "historical_impact + session_context enrichment from daily aggs (free tier ~5 req/min)",
    keyEnv: "POLYGON_API_KEY",
  },
  {
    id: "fmp-econ-calendar",
    order: 10,
    label: "FMP economic calendar",
    priority: "should",
    phase: "B",
    // Dedicated ~10m cron only — keep off 1-min fetch/all (free tier ~250/day).
    includeInFetchAll: false,
    contributes:
      "US high-impact econ releases with estimate/previous/actual (needs FMP credentials). Soft-skips on free-plan 402. Dedicated cron every ~10m — not on fetch/all.",
    keyEnv: "FMP_API_KEY",
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
 * - A: keyless Must sources in parallel (openFDA kept; CT.gov paused)
 * - B: PR wire + Finnhub
 * - C: Polygon prices only (polygon-news paused — hourly, not RT)
 *
 * Form4API was removed — SEC EDGAR Form 4 (+ ownership XML) covers insiders.
 */
export const FETCH_PHASES: readonly FetchPhaseDef[] = [
  {
    id: "A",
    label: "Keyless (parallel)",
    mode: "parallel",
    sources: ["sec-edgar", "nasdaq-halts", "macro-calendar", "openfda"],
  },
  {
    id: "B",
    label: "Keyed wire + calendars (parallel)",
    mode: "parallel",
    sources: ["pr-wire", "finnhub"],
  },
  {
    id: "C",
    label: "Polygon prices",
    mode: "sequential",
    sources: ["polygon-prices"],
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

/** False when catalog marks the source paused (`fetchEnabled: false`). */
export function isCatalystSourceFetchEnabled(id: CatalystSourceId): boolean {
  const meta = getCatalystSourceMeta(id);
  return meta?.fetchEnabled !== false;
}

/** Included in fetch/all phased orchestrator (excludes dedicated-cron-only). */
export function isCatalystSourceInFetchAll(id: CatalystSourceId): boolean {
  const meta = getCatalystSourceMeta(id);
  return isCatalystSourceFetchEnabled(id) && meta?.includeInFetchAll !== false;
}

/** Sources that still run in cron / Fetch all (paused + dedicated-only excluded). */
export function activeCatalystSourceIds(): CatalystSourceId[] {
  return CATALYST_SOURCE_IDS.filter((id) => isCatalystSourceInFetchAll(id));
}
