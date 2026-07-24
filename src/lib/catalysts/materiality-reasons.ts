/**
 * Derive plain-language materiality reasons when the DB row predates
 * `materiality_reasons` storage (or ingest skipped computeMateriality).
 * Prefer stored reasons when present — this is a display fallback only.
 */

import {
  CATEGORY_LABELS,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";
import {
  materialityFromScore,
  scoreFromCategory,
} from "@/lib/catalysts/materiality";

export function normalizeMaterialityReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (r): r is string => typeof r === "string" && r.trim().length > 0,
  );
}

/**
 * Returns stored reasons, or a single category-based fallback so the badge
 * always has something honest to show under "Why this score?".
 */
export function resolveMaterialityReasons(options: {
  reasons?: unknown;
  score: number | null | undefined;
  category?: EventCategoryKey | null;
}): string[] {
  const stored = normalizeMaterialityReasons(options.reasons);
  if (stored.length > 0) return stored;

  const m = materialityFromScore(options.score, options.category);
  const category = options.category;
  const label = category ? CATEGORY_LABELS[category] : "Other";
  const base = scoreFromCategory(category);
  return [
    `${label} (base ${base})`,
    `Tier: ${m.label} at ${m.score}/100 (rule-based)`,
  ];
}
