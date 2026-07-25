/**
 * Pure display helpers for article / tape enrichment.
 *
 * Kept free of `@/db/client` so Client Components can import these without
 * pulling the libSQL driver into the browser bundle (which then resolves to
 * `file:` and throws `URL_SCHEME_NOT_SUPPORTED`).
 */

/**
 * Vendor (Finnhub/Yahoo-style) country/market suffix → TradingView exchange
 * prefix. Only 2-3 letter codes are listed here — single-letter suffixes
 * (".A", ".B", ".PR"...) are legitimate US share-class/security tickers
 * (e.g. "BRK.B") and must never be treated as a stray vendor suffix.
 */
const VENDOR_SUFFIX_EXCHANGE: Record<string, string> = {
  TO: "TSX", // Toronto Stock Exchange
  NE: "CSE", // Canadian Securities Exchange
  AX: "ASX", // Australian Securities Exchange
  HK: "HKEX", // Hong Kong Stock Exchange
  PA: "EURONEXT", // Euronext Paris
  SW: "SIX", // SIX Swiss Exchange
  DE: "XETR", // Deutsche Börse Xetra
  MX: "BMV", // Bolsa Mexicana de Valores
};

/**
 * Splits a Yahoo/Finnhub-style dual-listing suffix (e.g. "BNS.TO") off a
 * ticker, but only when the suffix is a *known* 2-3 letter market code —
 * this avoids mangling real share-class tickers like "BRK.B" or "BF.A".
 */
function splitKnownVendorSuffix(
  raw: string,
): { base: string; exchangePrefix: string } | null {
  const match = /^([A-Z0-9]{1,10})\.([A-Z]{2,3})$/.exec(raw);
  if (!match) return null;
  const [, base, suffix] = match;
  const exchangePrefix = VENDOR_SUFFIX_EXCHANGE[suffix];
  return exchangePrefix ? { base, exchangePrefix } : null;
}

/**
 * Map ticker + vendor exchange string → TradingView `EXCHANGE:TICKER`.
 *
 * Vendors sometimes canonicalize a bare, dual-listed query to their foreign
 * listing and hand back a suffixed ticker instead (e.g. Finnhub's
 * `/stock/profile2?symbol=BNS` returns `ticker: "BNS.TO"`,
 * `exchange: "TORONTO STOCK EXCHANGE"`). TradingView has no symbol matching
 * that literal string — it needs the bare ticker plus a real exchange
 * prefix (`TSX:BNS`) — so we always strip a *known* vendor suffix before
 * applying the exchange-prefix rules below, and fall back to the suffix's
 * own market code when the exchange string itself doesn't say enough.
 */
export function toTradingViewSymbol(
  ticker: string,
  exchange: string | null | undefined,
): string {
  const raw = ticker.trim().toUpperCase();
  if (!raw) return raw;
  const ex = (exchange ?? "").toUpperCase();

  const vendorSuffix = splitKnownVendorSuffix(raw);
  const symbol = vendorSuffix?.base ?? raw;

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
  if (ex.includes("VENTURE")) return `TSXV:${symbol}`;
  if (ex.includes("TORONTO") || ex.includes("TSX")) return `TSX:${symbol}`;
  if (ex.includes("LONDON")) return `LSE:${symbol}`;

  if (vendorSuffix)
    return `${vendorSuffix.exchangePrefix}:${vendorSuffix.base}`;

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
