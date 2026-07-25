/**
 * Grounded LLM triage for catalysts — OpenRouter free models, on demand.
 *
 * This is explicitly NOT a predictive model and never invents facts: the
 * prompt only ever sees fields already persisted at ingest (title, headline,
 * summary, item codes, truncated body, session move %) and is instructed to
 * only restate what's there. See docs/research/
 * Catalyst-Intel-Client-Target-Guideline.md ("False AI confidence").
 *
 * Results are stored on the catalyst row (`aiBullets` / `aiLean` /
 * `aiUncertain`) and shared for every subsequent viewer. Re-analysis is
 * refused once stored. Soft-fails when OpenRouter is unconfigured or the
 * model returns unusable JSON.
 */

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { catalysts, rawSources, type AiLean } from "@/db/schema";
import {
  extractArticleBody,
  extractKeyFacts,
} from "@/lib/catalysts/article-content";
import { plainEnglishForSecForm } from "@/lib/catalysts/sec-form-plain-english";
import {
  getLastOpenRouterFailure,
  isOpenRouterConfigured,
  openRouterChatCompletion,
} from "@/lib/jobs/llm-provider";

/** Cap body context — prefer full extract story for meaningful triage. */
const BODY_CONTEXT_CHARS = 12_000;

const SYSTEM_PROMPT = `You are a patient explainer for entry-level investors reading a single market event (often an SEC filing).
Rules (must follow exactly):
1. ONLY use facts explicitly present in the user's text (title, summary, key facts, filing excerpts). NEVER invent numbers, coupons, barriers, prices, dates, names, or outcomes not stated.
2. Write for someone who is NOT a professional trader: plain English, define jargon briefly when you use it (e.g. what a 424B / structured note / shelf / Form 4 means IF that meaning is supported by the text).
3. Output exactly 2 or 3 bullets (each up to ~35 words). Bullets should answer: what happened, what the important numbers/facts are (if present), and what an investor should understand — without giving buy/sell advice.
4. If the text is too thin (e.g. only AccNo/Size metadata) or ambiguous, set lean to "uncertain", uncertain to true, and say clearly that details are limited in the filing text we have.
5. lean must be one of: "bullish"|"bearish"|"neutral"|"uncertain". Prefer "uncertain" or "neutral" for routine structured-note / shelf paperwork unless the text clearly implies equity dilution or a material company-specific shock.
6. Respond with ONLY valid JSON: {"bullets": string[], "lean": "bullish"|"bearish"|"neutral"|"uncertain", "uncertain": boolean}`;

export interface TriageInput {
  symbol?: string | null;
  companyName?: string | null;
  title: string;
  headline?: string | null;
  summary?: string | null;
  eventCategory?: string | null;
  itemCodes?: Array<{ code: string; label: string }> | null;
  sessionDeltaPct?: number | null;
  /** Filing / article body (prefer full extract snippets). */
  bodyExcerpt?: string | null;
  type?: string | null;
  /** Structured facts already extracted at ingest. */
  keyFacts?: Array<{ label: string; value: string }> | null;
  /** Plain-English form gloss when available. */
  formPlainEnglish?: string | null;
}

export interface TriageResult {
  bullets: string[];
  lean: AiLean;
  uncertain: boolean;
}

export type AnalyzeCatalystResult =
  | { ok: true; cached: boolean; analysis: TriageResult }
  | { ok: false; error: string; status: number };

function buildUserPrompt(input: TriageInput): string {
  const lines = [
    `Company: ${input.companyName ?? "unknown"} (${input.symbol ?? "no symbol"})`,
    `Form/type: ${input.type ?? "unknown"}`,
    `Category: ${input.eventCategory ?? "unknown"}`,
    `Title: ${input.title}`,
  ];
  if (input.formPlainEnglish) {
    lines.push(`Form in plain English: ${input.formPlainEnglish}`);
  }
  if (input.headline) lines.push(`Headline: ${input.headline}`);
  if (input.itemCodes?.length) {
    lines.push(
      `Filing items: ${input.itemCodes.map((i) => `${i.code} ${i.label}`).join("; ")}`,
    );
  }
  if (input.keyFacts?.length) {
    lines.push(
      `Key facts:\n${input.keyFacts.map((f) => `- ${f.label}: ${f.value}`).join("\n")}`,
    );
  }
  if (input.summary) lines.push(`Summary: ${input.summary}`);
  if (input.bodyExcerpt) {
    lines.push(`Event / filing text available:\n${input.bodyExcerpt}`);
  }
  if (typeof input.sessionDeltaPct === "number") {
    lines.push(
      `Session move since publish: ${input.sessionDeltaPct.toFixed(1)}%`,
    );
  }
  lines.push(
    "Explain this event so an entry-level investor understands what it is and why it might matter. Do not invent facts.",
  );
  return lines.join("\n");
}

export function parseTriageResponse(content: string): TriageResult | null {
  try {
    // Some free models wrap JSON in ``` fences — strip if present.
    const trimmed = content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    const parsed = JSON.parse(trimmed) as Partial<TriageResult>;
    const bullets = Array.isArray(parsed.bullets)
      ? parsed.bullets
          .filter(
            (b): b is string => typeof b === "string" && b.trim().length > 0,
          )
          .map((b) => b.trim())
          .slice(0, 3)
      : [];
    if (bullets.length === 0) return null;

    const leanRaw = typeof parsed.lean === "string" ? parsed.lean : "uncertain";
    const lean: AiLean = (
      ["bullish", "bearish", "neutral", "uncertain"] as const
    ).includes(leanRaw as AiLean)
      ? (leanRaw as AiLean)
      : "uncertain";

    return {
      bullets,
      lean,
      uncertain:
        typeof parsed.uncertain === "boolean"
          ? parsed.uncertain
          : lean === "uncertain",
    };
  } catch {
    return null;
  }
}

/** Calls OpenRouter for a single catalyst. Soft-fails to `null`. */
export async function triageCatalyst(
  input: TriageInput,
): Promise<TriageResult | null> {
  if (!isOpenRouterConfigured()) return null;

  const chat = await openRouterChatCompletion({
    temperature: 0.2,
    maxTokens: 700,
    jsonObject: true,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(input) },
    ],
  });
  if (!chat) {
    // Retry once without response_format — some free backends reject it.
    const fallback = await openRouterChatCompletion({
      temperature: 0.2,
      maxTokens: 700,
      jsonObject: false,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
    });
    if (!fallback) return null;
    return parseTriageResponse(fallback.content);
  }

  return parseTriageResponse(chat.content);
}

function storedAnalysis(row: {
  aiBullets: unknown;
  aiLean: string | null;
  aiUncertain: boolean | null;
}): TriageResult | null {
  if (!Array.isArray(row.aiBullets) || row.aiBullets.length === 0) return null;
  const bullets = row.aiBullets.filter(
    (b): b is string => typeof b === "string" && b.trim().length > 0,
  );
  if (bullets.length === 0) return null;
  const leanRaw = row.aiLean ?? "uncertain";
  const lean: AiLean = (
    ["bullish", "bearish", "neutral", "uncertain"] as const
  ).includes(leanRaw as AiLean)
    ? (leanRaw as AiLean)
    : "uncertain";
  return {
    bullets,
    lean,
    uncertain: row.aiUncertain ?? lean === "uncertain",
  };
}

/**
 * On-demand analyze: return cached triage if present, otherwise call the LLM
 * once, persist, and return. Concurrent callers: first write wins; losers
 * re-read the winner's stored result. Never re-analyzes a stored row.
 */
export async function analyzeCatalystOnDemand(
  catalystId: number,
): Promise<AnalyzeCatalystResult> {
  if (!isOpenRouterConfigured()) {
    return {
      ok: false,
      status: 503,
      error:
        "AI analysis is not configured. Set OPENROUTER_API_KEY (or OPENROUTER_API_KEYS) in the environment.",
    };
  }

  const row = await db
    .select({
      id: catalysts.id,
      symbol: catalysts.symbol,
      companyName: catalysts.companyName,
      type: catalysts.type,
      title: catalysts.title,
      headline: catalysts.headline,
      summary: catalysts.summary,
      eventCategory: catalysts.eventCategory,
      itemCodes: catalysts.itemCodes,
      historicalImpact: catalysts.historicalImpact,
      aiBullets: catalysts.aiBullets,
      aiLean: catalysts.aiLean,
      aiUncertain: catalysts.aiUncertain,
      sourceProvider: rawSources.provider,
      rawContent: rawSources.rawContent,
    })
    .from(catalysts)
    .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
    .where(eq(catalysts.id, catalystId))
    .get();

  if (!row) {
    return { ok: false, status: 404, error: "Catalyst not found." };
  }

  const cached = storedAnalysis(row);
  if (cached) {
    return { ok: true, cached: true, analysis: cached };
  }

  const { body } = extractArticleBody({
    provider: row.sourceProvider,
    rawContent: row.rawContent,
    summary: row.summary,
    title: row.title,
    headline: row.headline,
  });
  const bodyExcerpt =
    body.trim().length > 0 ? body.trim().slice(0, BODY_CONTEXT_CHARS) : null;

  const keyFacts = extractKeyFacts(row.rawContent);
  const formPlainEnglish = plainEnglishForSecForm(row.type);

  const historicalImpact = row.historicalImpact as
    { pctChange?: number } | null | undefined;

  const result = await triageCatalyst({
    symbol: row.symbol,
    companyName: row.companyName,
    type: row.type,
    title: row.title,
    headline: row.headline,
    summary: row.summary,
    eventCategory: row.eventCategory,
    itemCodes: Array.isArray(row.itemCodes)
      ? (row.itemCodes as Array<{ code: string; label: string }>)
      : null,
    sessionDeltaPct:
      typeof historicalImpact?.pctChange === "number"
        ? historicalImpact.pctChange
        : null,
    bodyExcerpt,
    keyFacts: keyFacts.length > 0 ? keyFacts : null,
    formPlainEnglish,
  });

  if (!result) {
    const detail = getLastOpenRouterFailure();
    return {
      ok: false,
      status: 502,
      error:
        detail ??
        "AI analysis is not available at the moment. Try again shortly.",
    };
  }

  // First writer wins — never overwrite an existing analysis.
  await db
    .update(catalysts)
    .set({
      aiBullets: result.bullets,
      aiLean: result.lean,
      aiUncertain: result.uncertain,
    })
    .where(and(eq(catalysts.id, catalystId), isNull(catalysts.aiBullets)))
    .run();

  const after = await db
    .select({
      aiBullets: catalysts.aiBullets,
      aiLean: catalysts.aiLean,
      aiUncertain: catalysts.aiUncertain,
    })
    .from(catalysts)
    .where(eq(catalysts.id, catalystId))
    .get();

  const final = after ? storedAnalysis(after) : result;
  if (!final) {
    return { ok: false, status: 502, error: "Failed to persist AI analysis." };
  }

  return { ok: true, cached: false, analysis: final };
}
