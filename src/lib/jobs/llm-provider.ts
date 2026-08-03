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

/**
 * Default free model — keep in sync with what OpenRouter still lists as
 * `:free`. Older slugs (e.g. llama-3.3-70b-instruct:free) get retired and
 * return 404 "unavailable for free".
 */
const DEFAULT_OPENROUTER_MODEL = "openai/gpt-oss-20b:free";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

let roundRobin = 0;
let lastFailure: string | null = null;

/** Last OpenRouter failure detail (for user-facing errors / ops). */
export function getLastOpenRouterFailure(): string | null {
  return lastFailure;
}

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
  if (keys.length === 0) {
    lastFailure = "OpenRouter is not configured.";
    return null;
  }

  const model = getOpenRouterModel();
  const start = roundRobin % keys.length;
  lastFailure = null;
  let sawRateLimit = false;
  let lastStatus: number | null = null;
  let lastMessage: string | null = null;

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
            "https://catalyst-intel-rouge.vercel.app",
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

      lastStatus = res.status;

      if (res.status === 429 || res.status === 402) {
        sawRateLimit = true;
        lastMessage = await readOpenRouterError(res);
        continue;
      }
      if (!res.ok) {
        lastMessage = await readOpenRouterError(res);
        continue;
      }

      const payload = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
      };
      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) {
        lastMessage = "OpenRouter returned an empty completion.";
        continue;
      }

      lastFailure = null;
      return {
        content,
        model: payload.model ?? model,
        keyIndex,
      };
    } catch (err) {
      lastMessage =
        err instanceof Error ? err.message : "OpenRouter request failed.";
      continue;
    }
  }

  if (lastMessage?.toLowerCase().includes("unavailable for free")) {
    lastFailure = `Free model unavailable (${model}). Set OPENROUTER_MODEL to a current free slug (e.g. openai/gpt-oss-20b:free).`;
  } else if (sawRateLimit) {
    lastFailure =
      "OpenRouter free-tier rate limit hit. Try again in a minute, or add more keys via OPENROUTER_API_KEYS.";
  } else if (lastStatus === 401 || lastStatus === 403) {
    lastFailure = "OpenRouter rejected the API key.";
  } else if (lastMessage) {
    lastFailure = lastMessage;
  } else {
    lastFailure = "OpenRouter request failed.";
  }

  return null;
}

async function readOpenRouterError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: { message?: string } | string;
    };
    if (typeof body.error === "string" && body.error.trim()) {
      return body.error.trim();
    }
    if (
      body.error &&
      typeof body.error === "object" &&
      typeof body.error.message === "string" &&
      body.error.message.trim()
    ) {
      return body.error.message.trim();
    }
  } catch {
    // ignore JSON parse failures
  }
  return `OpenRouter HTTP ${res.status}`;
}

/** Test helper — reset round-robin cursor. */
export function resetOpenRouterRoundRobin() {
  roundRobin = 0;
  lastFailure = null;
}
