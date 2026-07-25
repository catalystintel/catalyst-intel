/**
 * OpenAI-compatible chat completions for free-tier LLM triage.
 *
 * Primary: OpenRouter `:free` models (no card required). Supports a pool of
 * API keys (`OPENROUTER_API_KEYS` comma-separated, or singular
 * `OPENROUTER_API_KEY`) with round-robin + 429 failover so a small team can
 * stack free quotas. Soft-fails when no key is configured.
 */

export type LlmChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmChatResult = {
  content: string;
  model: string;
  keyIndex: number;
};

/** Default: Llama 3.3 70B instruct on OpenRouter's free pool — solid JSON. */
const DEFAULT_OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

let roundRobin = 0;

/** Parsed key pool (trim, drop empties). Exposed for tests. */
export function getOpenRouterApiKeys(): string[] {
  const multi = process.env.OPENROUTER_API_KEYS?.trim();
  if (multi) {
    return multi
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  }
  const single = process.env.OPENROUTER_API_KEY?.trim();
  return single ? [single] : [];
}

export function isOpenRouterConfigured(): boolean {
  return getOpenRouterApiKeys().length > 0;
}

export function getOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
}

/**
 * Calls OpenRouter chat completions. Tries the next key on 429 / 402.
 * Returns `null` when unconfigured or every key fails.
 */
export async function openRouterChatCompletion(options: {
  messages: LlmChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonObject?: boolean;
  timeoutMs?: number;
}): Promise<LlmChatResult | null> {
  const keys = getOpenRouterApiKeys();
  if (keys.length === 0) return null;

  const model = getOpenRouterModel();
  const start = roundRobin % keys.length;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const keyIndex = (start + attempt) % keys.length;
    const apiKey = keys[keyIndex]!;
    roundRobin = keyIndex + 1;

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          // Optional but recommended by OpenRouter for rankings / limits.
          "HTTP-Referer":
            process.env.NEXT_PUBLIC_APP_URL?.trim() ||
            "https://catalyst-intel.vercel.app",
          "X-Title": "Catalyst Intel",
        },
        body: JSON.stringify({
          model,
          temperature: options.temperature ?? 0.1,
          max_tokens: options.maxTokens ?? 400,
          ...(options.jsonObject
            ? { response_format: { type: "json_object" } }
            : {}),
          messages: options.messages,
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 25_000),
      });

      if (res.status === 429 || res.status === 402) {
        continue;
      }
      if (!res.ok) {
        continue;
      }

      const payload = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
      };
      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) continue;

      return {
        content,
        model: payload.model ?? model,
        keyIndex,
      };
    } catch {
      continue;
    }
  }

  return null;
}

/** Test helper — reset round-robin cursor. */
export function resetOpenRouterRoundRobin() {
  roundRobin = 0;
}
