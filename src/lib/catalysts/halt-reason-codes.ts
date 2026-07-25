/**
 * Nasdaq Trade Halt reason codes → short human labels.
 * Source: https://www.nasdaqtrader.com/trader.aspx?id=tradehaltcodes
 * Refresh when Nasdaq updates codes (rare).
 */

export const HALT_REASON_CODES: Record<string, string> = {
  T1: "News pending",
  T2: "News released",
  T3: "News disseminated / resumption times",
  T5: "Single-stock trading pause",
  T6: "Extraordinary market activity",
  T7: "Single-stock pause (quotation-only)",
  T8: "ETF trading halt",
  T12: "Additional information requested",
  H4: "Non-compliance with listing requirements",
  H9: "Not current in required filings",
  H10: "SEC trading suspension",
  H11: "Regulatory concern",
  O1: "Operations halt",
  IPO1: "IPO not yet trading",
  IPOQ: "IPO released for quotation",
  IPOE: "IPO positioning window extension",
  M1: "Corporate action",
  M2: "Quotation not available",
  M: "Volatility trading pause",
  LUDP: "Volatility trading pause (LULD)",
  LUDS: "Volatility trading pause — straddle",
  MWC0: "Market-wide circuit breaker (carry-over)",
  MWC1: "Market-wide circuit breaker — Level 1",
  MWC2: "Market-wide circuit breaker — Level 2",
  MWC3: "Market-wide circuit breaker — Level 3",
  MWCQ: "Market-wide circuit breaker resumption",
  R1: "New issue available",
  R2: "Issue available",
  R4: "Qualifications resolved — resuming",
  R9: "Filing requirements satisfied — resuming",
  C3: "Issuer news not forthcoming — resuming",
  C4: "Qualifications halt ended — resuming",
  C9: "Qualifications halt concluded — resuming",
  C11: "Regulatory halt concluded — resuming",
  D: "Security deletion",
};

const RESUME_CODES = new Set([
  "T3",
  "T7",
  "R1",
  "R2",
  "R4",
  "R9",
  "C3",
  "C4",
  "C9",
  "C11",
  "IPOQ",
  "IPOE",
  "MWCQ",
]);

/** Normalize a raw reason code from the RSS (`T1`, `t1`, etc.). */
export function normalizeHaltReasonCode(
  code: string | null | undefined,
): string | null {
  const trimmed = code?.trim().toUpperCase();
  if (!trimmed || trimmed === "SPACE") return null;
  return trimmed;
}

/**
 * Human label for a halt reason code.
 * Unknown codes fall back to `Reason code {CODE}` rather than empty text.
 */
export function haltReasonLabel(code: string | null | undefined): string {
  const normalized = normalizeHaltReasonCode(code);
  if (!normalized) return "Reason unavailable";
  return HALT_REASON_CODES[normalized] ?? `Reason code ${normalized}`;
}

export function isResumeHaltCode(code: string | null | undefined): boolean {
  const normalized = normalizeHaltReasonCode(code);
  return normalized != null && RESUME_CODES.has(normalized);
}

/** Pause-style codes (LULD / single-stock pause). */
export function isPauseHaltCode(code: string | null | undefined): boolean {
  const normalized = normalizeHaltReasonCode(code);
  if (!normalized) return false;
  return (
    normalized === "LUDP" ||
    normalized === "LUDS" ||
    normalized === "M" ||
    normalized === "T5" ||
    normalized === "T7"
  );
}
