/**
 * Helpers for reading session-move / price context off a catalyst's
 * `historicalImpact` JSON. Soft-fails to nulls when enrichment hasn't run.
 */

export interface SessionMove {
  pctChange: number;
  date?: string;
}

export function parseSessionMove(
  historicalImpact: unknown,
): SessionMove | null {
  if (
    !historicalImpact ||
    typeof historicalImpact !== "object" ||
    Array.isArray(historicalImpact)
  ) {
    return null;
  }
  const rec = historicalImpact as Record<string, unknown>;
  const pct = rec.pctChange;
  if (typeof pct !== "number" || !Number.isFinite(pct)) return null;
  return {
    pctChange: pct,
    date: typeof rec.date === "string" ? rec.date : undefined,
  };
}

export function formatSessionMove(move: SessionMove): string {
  const sign = move.pctChange > 0 ? "+" : "";
  const base = `${sign}${move.pctChange.toFixed(2)}%`;
  return move.date ? `${base} · ${move.date}` : base;
}
