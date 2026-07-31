/**
 * Optional vendor API keys. Soft-fail when unset — fetch jobs return
 * configured:false instead of throwing.
 */

export function getFinnhubApiKey(): string | null {
  const key = process.env.FINNHUB_API_KEY?.trim();
  return key || null;
}

export function isFinnhubConfigured(): boolean {
  return getFinnhubApiKey() !== null;
}

/**
 * Financial Modeling Prep — economic calendar (optional).
 * Soft-fail when unset. Free keys may 402 on `/stable/economic-calendar`
 * (premium-gated); treat that as skipped, not a hard outage.
 */
export function getFmpApiKey(): string | null {
  const key = process.env.FMP_API_KEY?.trim();
  return key || null;
}

export function isFmpConfigured(): boolean {
  return getFmpApiKey() !== null;
}

export function getPolygonApiKey(): string | null {
  const key =
    process.env.POLYGON_API_KEY?.trim() ||
    process.env.MASSIVE_API_KEY?.trim() ||
    null;
  return key || null;
}

export function isPolygonConfigured(): boolean {
  return getPolygonApiKey() !== null;
}

export function getForm4ApiKey(): string | null {
  const key = process.env.FORM4_API_KEY?.trim();
  return key || null;
}

export function isForm4ApiConfigured(): boolean {
  return getForm4ApiKey() !== null;
}

/**
 * Optional authenticated PR wire upgrade. Default ingest uses the keyless
 * public high-impact board (no credentials). Product copy always says "PR wire".
 */
export function getPrWireApiKey(): string | null {
  const key = process.env.PR_WIRE_API_KEY?.trim();
  return key || null;
}

/** Optional HTTPS origin for authenticated full-feed upgrade (no trailing slash). */
export function getPrWireApiBase(): string | null {
  const base = process.env.PR_WIRE_API_BASE?.trim().replace(/\/+$/, "");
  if (!base) return null;
  if (!/^https:\/\//i.test(base)) return null;
  return base;
}

/** Always true — keyless public scrape needs no env. */
export function isPrWireConfigured(): boolean {
  return true;
}

/**
 * OpenRouter free-tier LLM for on-demand AI analysis.
 * Prefer helpers in `llm-provider.ts` (key pool + failover). These thin
 * wrappers remain for env-check call sites.
 */
export {
  getOpenRouterApiKeys,
  getOpenRouterModel,
  isOpenRouterConfigured,
} from "@/lib/jobs/llm-provider";
