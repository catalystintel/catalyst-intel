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

/** Groq free-tier LLM (grounded triage only — see lib/jobs/llm-triage.ts). */
export function getGroqApiKey(): string | null {
  const key = process.env.GROQ_API_KEY?.trim();
  return key || null;
}

export function isGroqConfigured(): boolean {
  return getGroqApiKey() !== null;
}

const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

export function getGroqModel(): string {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
}
