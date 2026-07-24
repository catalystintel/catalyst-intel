/**
 * Pure display helpers for article / tape enrichment.
 *
 * Kept free of `@/db/client` so Client Components can import these without
 * pulling the libSQL driver into the browser bundle (which then resolves to
 * `file:` and throws `URL_SCHEME_NOT_SUPPORTED`).
 */

/** Map vendor exchange string → TradingView `EXCHANGE:TICKER` when possible. */
export function toTradingViewSymbol(
  ticker: string,
  exchange: string | null | undefined,
): string {
  const symbol = ticker.trim().toUpperCase();
  const ex = (exchange ?? "").toUpperCase();
  if (!symbol) return symbol;
  if (ex.includes("NASDAQ")) return `NASDAQ:${symbol}`;
  if (
    ex.includes("AMEX") ||
    ex.includes("NYSE MKT") ||
    ex.includes("NYSE ARCA") ||
    ex.includes("ARCA")
  ) {
    return `AMEX:${symbol}`;
  }
  if (ex.includes("NYSE") || ex.includes("NEW YORK")) return `NYSE:${symbol}`;
  if (ex.includes("OTC") || ex.includes("PINK")) return `OTC:${symbol}`;
  return symbol;
}

/** Format Finnhub market cap (millions USD) for desk display. */
export function formatMarketCapMillions(
  millions: number | null | undefined,
): string | null {
  if (millions == null || !Number.isFinite(millions) || millions <= 0) {
    return null;
  }
  if (millions >= 1_000_000) {
    return `$${(millions / 1_000_000).toFixed(2)}T`;
  }
  if (millions >= 1_000) {
    return `$${(millions / 1_000).toFixed(2)}B`;
  }
  return `$${millions.toFixed(1)}M`;
}
