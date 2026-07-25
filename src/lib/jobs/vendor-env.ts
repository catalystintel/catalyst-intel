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
 * OpenRouter free-tier LLM for on-demand AI analysis.
 * Prefer helpers in `llm-provider.ts` (key pool + failover). These thin
 * wrappers remain for env-check call sites.
 */
export {
  getOpenRouterApiKeys,
  getOpenRouterModel,
  isOpenRouterConfigured,
} from "@/lib/jobs/llm-provider";
