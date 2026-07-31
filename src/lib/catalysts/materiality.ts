import {
  CATEGORY_LABELS,
  CATEGORY_PRIORITY,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";
import type { AlertSession, SentimentLean } from "@/db/schema";

export type MaterialityTier = "high" | "medium" | "low";

export interface MaterialityDisplay {
  /** Rule-based score 0–100 (category priority until AI scoring). */
  score: number;
  tier: MaterialityTier;
  label: string;
}

/**
 * Derives a 0–100 impact score from the primary event category.
 * Used at ingest when AI scoring is not yet wired.
 */
export function scoreFromCategory(
  category: EventCategoryKey | null | undefined,
): number {
  if (!category) return CATEGORY_PRIORITY.other;
  return CATEGORY_PRIORITY[category] ?? CATEGORY_PRIORITY.other;
}

/**
 * Maps a stored or computed impact score into a trader-facing tier.
 */
export function materialityFromScore(
  score: number | null | undefined,
  fallbackCategory?: EventCategoryKey | null,
): MaterialityDisplay {
  const resolved =
    typeof score === "number" && Number.isFinite(score)
      ? Math.max(0, Math.min(100, Math.round(score)))
      : scoreFromCategory(fallbackCategory);

  let tier: MaterialityTier;
  if (resolved >= 70) tier = "high";
  else if (resolved >= 45) tier = "medium";
  else tier = "low";

  const label = tier === "high" ? "High" : tier === "medium" ? "Medium" : "Low";

  return { score: resolved, tier, label };
}

/**
 * Extra weight for specific 8-K items beyond their category's base score —
 * these are the items that most reliably move price on their own even
 * within a broad category like "management" or "distress".
 */
const ITEM_WEIGHT_BONUS: Record<string, number> = {
  "1.03": 8, // Bankruptcy / receivership
  "1.05": 6, // Material cybersecurity incident
  "2.04": 6, // Debt acceleration
  "2.06": 5, // Material impairment
  "3.01": 8, // Delisting risk
  "4.02": 10, // Non-reliance on prior financials (restatement)
  "5.02": 4, // Officer / director change (CEO/CFO departures move stocks)
};

const MICROCAP_CEILING_MILLIONS = 300;
const MEGACAP_FLOOR_MILLIONS = 50_000;
const LARGE_SESSION_MOVE_PCT = 5;
const EXTREME_SESSION_MOVE_PCT = 10;

export interface MaterialityInput {
  eventCategory?: EventCategoryKey | null;
  itemCodes?: Array<{ code: string }> | null;
  /** Company market cap in millions of USD, when known. */
  marketCapMillions?: number | null;
  session?: AlertSession | null;
  sentiment?: SentimentLean | null;
  /** Absolute % move since publish, when a same/prior-session bar exists. */
  sessionDeltaPct?: number | null;
}

export interface MaterialityResult {
  score: number;
  reasons: string[];
}

/**
 * Materiality v2 — deterministic, explainable score (0-100) that goes beyond
 * category priority: item-level weight, liquidity, session timing, and
 * directional sentiment / session move all nudge the score with a plain-
 * language reason attached, so "Why this score?" never needs an LLM.
 */
export function computeMateriality(input: MaterialityInput): MaterialityResult {
  const category = input.eventCategory ?? "other";
  const base = scoreFromCategory(category);
  const reasons: string[] = [`${CATEGORY_LABELS[category] ?? "Other"} event`];
  let score = base;

  const itemBonus = (input.itemCodes ?? []).reduce(
    (max, item) => Math.max(max, ITEM_WEIGHT_BONUS[item.code] ?? 0),
    0,
  );
  if (itemBonus > 0) {
    score += itemBonus;
    reasons.push(`High-weight filing item (+${itemBonus})`);
  }

  const mcap = input.marketCapMillions;
  if (typeof mcap === "number" && Number.isFinite(mcap)) {
    if (mcap > 0 && mcap < MICROCAP_CEILING_MILLIONS) {
      score += 6;
      reasons.push("Microcap (<$300M) — event moves it more (+6)");
    } else if (mcap >= MEGACAP_FLOOR_MILLIONS) {
      score -= 6;
      reasons.push("Mega-cap — single event less likely to move it much (-6)");
    }
  }

  if (input.session === "AH" || input.session === "PM") {
    score += 8;
    reasons.push(
      `${input.session === "AH" ? "After-hours" : "Pre-market"} — thin liquidity amplifies moves (+8)`,
    );
  }

  if (input.sentiment === "bullish" || input.sentiment === "bearish") {
    score += 4;
    reasons.push(`Directional (${input.sentiment}) sentiment detected (+4)`);
  }

  const delta = input.sessionDeltaPct;
  if (typeof delta === "number" && Number.isFinite(delta)) {
    const abs = Math.abs(delta);
    if (abs >= EXTREME_SESSION_MOVE_PCT) {
      score += 15;
      reasons.push(`Already moved ${delta.toFixed(1)}% since publish (+15)`);
    } else if (abs >= LARGE_SESSION_MOVE_PCT) {
      score += 10;
      reasons.push(`Already moved ${delta.toFixed(1)}% since publish (+10)`);
    }
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}
