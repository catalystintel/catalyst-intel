/**
 * AI-assisted watchlist rule drafting — turns a plain-English prompt into a
 * `WatchlistCriteria` combo the user can review, tweak, and save (or refine
 * again with another prompt, using the current draft as context). Same free
 * OpenRouter provider as on-demand catalyst triage (`llm-triage.ts`);
 * soft-fails identically when unconfigured.
 */

import type { WatchlistCriteria } from "@/db/schema";
import { FEED_FORM_LABELS } from "@/lib/catalysts/feed-form-filters";
import { CATEGORY_LABELS } from "@/lib/catalysts/taxonomy";
import {
  getLastOpenRouterFailure,
  isOpenRouterConfigured,
  openRouterChatCompletion,
} from "@/lib/jobs/llm-provider";
import { normalizeWatchlistCriteria } from "@/lib/watchlist/normalize-criteria";

export interface WatchlistDraft {
  name: string;
  criteria: WatchlistCriteria;
  /** One-sentence explanation of how the rule matches the prompt. */
  rationale: string;
}

export type WatchlistDraftResult =
  { ok: true; draft: WatchlistDraft } | { ok: false; error: string };

const CATEGORY_LIST = Object.entries(CATEGORY_LABELS)
  .map(([key, label]) => `"${key}" (${label})`)
  .join(", ");

const FORM_LIST = Object.entries(FEED_FORM_LABELS)
  .map(([key, label]) => `"${key}" (${label})`)
  .join(", ");

const SYSTEM_PROMPT = `You turn a trader's plain-English request into a structured watchlist rule for a catalyst-tracking feed. Respond with ONLY valid JSON — no prose, no markdown fences.

Output shape:
{"name": string, "rationale": string, "criteria": {"symbols"?: string[], "categories"?: string[], "forms"?: string[], "tags"?: string[], "q"?: string}}

Field rules (all optional — omit any axis you don't need; empty criteria is invalid):
- "symbols": exact ticker matches, uppercase (e.g. "NVDA"). Only when the user names specific companies/tickers.
- "categories": event-type buckets, ONLY from this list: ${CATEGORY_LIST}.
- "forms": SEC form buckets, ONLY from this list: ${FORM_LIST}.
- "tags": lowercase any-match tags. Prefer these namespaced auto-tags when they fit: "category:<key>" (same keys as above), "form:<key>" (lowercase form key, e.g. "form:8-k"), "session:ah" / "session:pm" / "session:rth" (after-hours / pre-market / regular hours), "sentiment:bullish" / "sentiment:bearish" / "sentiment:neutral". You may also use free-form vendor tags when clearly implied (e.g. "fda", "ipo", "13d", "analyst", "approval") — do not invent obscure ones. Never use "impact:*" tags (impact score is retired).
- "q": a short free-text fallback ONLY if nothing else captures the intent (rare — prefer structured fields).
- Don't duplicate a concept across "categories" and "tags" (e.g. don't add both categories:["earnings"] and tags:["category:earnings"] for the same idea) unless the user's request genuinely needs both an event-type gate AND a tag gate (e.g. "AH" session for earnings).

"name": a short (<=6 word) human title for the rule.
"rationale": one sentence, plain English, explaining what the rule matches and why you chose those fields.

When given an "Existing rule" in the user message, treat the new instruction as a refinement: keep whatever the existing rule already got right and only change what the instruction asks for.`;

function buildUserPrompt(
  prompt: string,
  existing?: { name?: string; criteria?: WatchlistCriteria },
): string {
  const lines = [`Request: ${prompt.trim()}`];
  if (existing?.criteria && Object.keys(existing.criteria).length > 0) {
    lines.push(
      `Existing rule name: ${existing.name ?? "Untitled"}`,
      `Existing rule criteria: ${JSON.stringify(existing.criteria)}`,
    );
  }
  return lines.join("\n");
}

export function parseWatchlistDraftResponse(
  content: string,
): WatchlistDraft | null {
  try {
    const trimmed = content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    const parsed = JSON.parse(trimmed) as {
      name?: unknown;
      rationale?: unknown;
      criteria?: unknown;
    };
    const criteria = normalizeWatchlistCriteria(parsed.criteria);
    if (Object.keys(criteria).length === 0) return null;
    const name =
      typeof parsed.name === "string" && parsed.name.trim()
        ? parsed.name.trim().slice(0, 80)
        : "AI-drafted watchlist";
    const rationale =
      typeof parsed.rationale === "string" && parsed.rationale.trim()
        ? parsed.rationale.trim().slice(0, 300)
        : "";
    return { name, criteria, rationale };
  } catch {
    return null;
  }
}

/** Drafts (or refines, given `existing`) a watchlist rule. Soft-fails to an error string. */
export async function draftWatchlistWithAI(
  prompt: string,
  existing?: { name?: string; criteria?: WatchlistCriteria },
): Promise<WatchlistDraftResult> {
  if (!prompt.trim()) {
    return { ok: false, error: "Describe the rule you want first." };
  }
  if (!isOpenRouterConfigured()) {
    return {
      ok: false,
      error:
        "AI drafting is not available on this deployment. Build the rule manually or from a template below.",
    };
  }

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "user" as const, content: buildUserPrompt(prompt, existing) },
  ];

  const chat = await openRouterChatCompletion({
    temperature: 0.2,
    maxTokens: 500,
    jsonObject: true,
    messages,
  });
  const content =
    chat?.content ??
    (
      await openRouterChatCompletion({
        temperature: 0.2,
        maxTokens: 500,
        jsonObject: false,
        messages,
      })
    )?.content;

  if (!content) {
    return {
      ok: false,
      error:
        getLastOpenRouterFailure() ??
        "AI drafting is not available at the moment. Try again shortly.",
    };
  }

  const draft = parseWatchlistDraftResponse(content);
  if (!draft) {
    return {
      ok: false,
      error:
        "Couldn't turn that into a rule — try rephrasing with specific symbols, event types, or forms.",
    };
  }
  return { ok: true, draft };
}
