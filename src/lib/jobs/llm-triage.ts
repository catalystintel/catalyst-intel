/**
 * Free-tier LLM triage (Groq) — grounded strictly in stored ingest text.
 *
 * This is explicitly NOT a predictive model and never invents facts: the
 * prompt only ever sees fields already persisted at ingest (title, headline,
 * summary, item codes, session move %) and is instructed to only restate
 * what's there. See docs/research/Catalyst-Intel-Client-Target-Guideline.md
 * ("False AI confidence" failure mode) — triage output must stay subordinate
 * to primary-source proof, never presented as verified truth.
 *
 * Soft-fails to `null` without GROQ_API_KEY, on any HTTP error, or when the
 * model's response isn't valid triage JSON — callers must treat `null` as
 * "not triaged yet", not as an error.
 */

import { and, desc, eq, inArray, isNull, isNotNull } from "drizzle-orm";

import { db } from "@/db/client";
import { catalysts, type AiLean } from "@/db/schema";
import { getGroqApiKey, getGroqModel } from "@/lib/jobs/vendor-env";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_BATCH_LIMIT = 8;

/** Categories where a short LLM triage adds signal beyond the raw row. */
const ELIGIBLE_CATEGORIES = new Set([
  "earnings",
  "deals",
  "management",
  "capital",
  "distress",
  "restructuring",
  "governance",
  "disclosure",
  "regulatory",
  "clinical",
  "cyber",
  "analyst",
]);

const SYSTEM_PROMPT = `You are a financial filing triage assistant for active traders.
Rules (must follow exactly):
1. ONLY use facts explicitly present in the user's text. NEVER invent numbers, dates, names, or outcomes not stated.
2. If the text is too thin or ambiguous to support a lean, set lean to "uncertain" and uncertain to true.
3. Output 1-3 short bullets (max ~18 words each), each a plain restatement or direct implication of stated facts — no speculation.
4. Respond with ONLY valid JSON matching: {"bullets": string[], "lean": "bullish"|"bearish"|"neutral"|"uncertain", "uncertain": boolean}`;

export interface TriageInput {
  ticker?: string | null;
  companyName?: string | null;
  title: string;
  headline?: string | null;
  summary?: string | null;
  eventCategory?: string | null;
  itemCodes?: Array<{ code: string; label: string }> | null;
  sessionDeltaPct?: number | null;
}

export interface TriageResult {
  bullets: string[];
  lean: AiLean;
  uncertain: boolean;
}

function buildUserPrompt(input: TriageInput): string {
  const lines = [
    `Company: ${input.companyName ?? "unknown"} (${input.ticker ?? "no ticker"})`,
    `Category: ${input.eventCategory ?? "unknown"}`,
    `Title: ${input.title}`,
  ];
  if (input.headline) lines.push(`Headline: ${input.headline}`);
  if (input.itemCodes?.length) {
    lines.push(
      `Filing items: ${input.itemCodes.map((i) => `${i.code} ${i.label}`).join("; ")}`,
    );
  }
  if (input.summary) lines.push(`Text: ${input.summary}`);
  if (typeof input.sessionDeltaPct === "number") {
    lines.push(
      `Session move since publish: ${input.sessionDeltaPct.toFixed(1)}%`,
    );
  }
  return lines.join("\n");
}

function parseTriageResponse(content: string): TriageResult | null {
  try {
    const parsed = JSON.parse(content) as Partial<TriageResult>;
    const bullets = Array.isArray(parsed.bullets)
      ? parsed.bullets
          .filter((b): b is string => typeof b === "string")
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

/** Calls Groq for a single catalyst. Soft-fails to `null`. */
export async function triageCatalyst(
  input: TriageInput,
): Promise<TriageResult | null> {
  const apiKey = getGroqApiKey();
  if (!apiKey) return null;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getGroqModel(),
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(input) },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) return null;

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;

    return parseTriageResponse(content);
  } catch {
    return null;
  }
}

/**
 * Batch-triages the highest-impact untriaged eligible catalysts from the
 * current ingest run. Capped small to respect Groq's free-tier rate limits
 * and keep each cron tick fast; remaining rows pick up next run.
 */
export async function runLlmTriageBatch(options?: {
  limit?: number;
}): Promise<{ triaged: number; skipped: number }> {
  if (!getGroqApiKey()) return { triaged: 0, skipped: 0 };

  const limit = options?.limit ?? DEFAULT_BATCH_LIMIT;
  const categories = [...ELIGIBLE_CATEGORIES];

  const candidates = await db
    .select({
      id: catalysts.id,
      ticker: catalysts.ticker,
      companyName: catalysts.companyName,
      title: catalysts.title,
      headline: catalysts.headline,
      summary: catalysts.summary,
      eventCategory: catalysts.eventCategory,
      itemCodes: catalysts.itemCodes,
      historicalImpact: catalysts.historicalImpact,
    })
    .from(catalysts)
    .where(
      and(
        isNull(catalysts.aiBullets),
        isNotNull(catalysts.eventCategory),
        inArray(catalysts.eventCategory, categories),
      ),
    )
    .orderBy(desc(catalysts.impactScore), desc(catalysts.timestamp))
    .limit(limit)
    .all();

  let triaged = 0;
  let skipped = 0;

  for (const row of candidates) {
    const historicalImpact = row.historicalImpact as
      { pctChange?: number } | null | undefined;

    const result = await triageCatalyst({
      ticker: row.ticker,
      companyName: row.companyName,
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
    });

    if (!result) {
      skipped++;
      continue;
    }

    await db
      .update(catalysts)
      .set({
        aiBullets: result.bullets,
        aiLean: result.lean,
        aiUncertain: result.uncertain,
      })
      .where(eq(catalysts.id, row.id))
      .run();
    triaged++;
  }

  return { triaged, skipped };
}
