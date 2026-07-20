import {
  CATEGORY_PRIORITY,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";

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
