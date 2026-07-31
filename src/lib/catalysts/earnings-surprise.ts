/**
 * Material earnings-surprise threshold for the Live tape filter.
 * abs(EPS surprise %) at or above this counts as a report worth isolating.
 */
export const MATERIAL_EPS_SURPRISE_PCT = 5;

/**
 * Compute EPS surprise % from actual vs estimate.
 * Matches article-detail `surprisePctFrom` (percent points, not ratio).
 */
export function epsSurprisePctFrom(
  actual: number | null | undefined,
  estimate: number | null | undefined,
  explicit?: number | null,
): number | null {
  if (explicit != null && Number.isFinite(explicit)) return explicit;
  if (
    actual == null ||
    estimate == null ||
    !Number.isFinite(actual) ||
    !Number.isFinite(estimate) ||
    estimate === 0
  ) {
    return null;
  }
  return ((actual - estimate) / Math.abs(estimate)) * 100;
}

export function isMaterialEpsSurprise(
  surprisePct: number | null | undefined,
  threshold = MATERIAL_EPS_SURPRISE_PCT,
): boolean {
  return (
    surprisePct != null &&
    Number.isFinite(surprisePct) &&
    Math.abs(surprisePct) >= threshold
  );
}
