/**
 * Normalize desk / TradingView symbols for OHLC + quote vendors.
 *
 * The split panel historically passed TradingView ids (`NASDAQ:SKK`) into
 * Finnhub/Polygon/Yahoo candle routes — those APIs expect a bare ticker
 * (`SKK`) or Yahoo's share-class form (`BRK-B`), so every chart came back empty.
 */

/** Strip a leading `EXCHANGE:` prefix from TradingView-style ids. */
export function stripExchangePrefix(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return "";
  const colon = trimmed.indexOf(":");
  if (colon <= 0 || colon === trimmed.length - 1) return trimmed;
  // Only treat as exchange prefix when the left side looks like a venue code
  // (letters, 1–6 chars) — never strip times or odd junk.
  const exchange = trimmed.slice(0, colon);
  const rest = trimmed.slice(colon + 1);
  if (!/^[A-Z]{1,6}$/.test(exchange)) return trimmed;
  if (!/^[A-Z0-9][A-Z0-9.\-]{0,14}$/.test(rest)) return trimmed;
  return rest;
}

/**
 * Bare vendor symbol for Finnhub / Polygon (US share classes keep the dot:
 * `BRK.B`).
 */
export function toVendorBareSymbol(raw: string): string {
  return stripExchangePrefix(raw);
}

/**
 * Yahoo Finance chart/quote ticker. US share classes use a hyphen
 * (`BRK.B` → `BRK-B`); dual-listed suffixes stay dotted (`BNS.TO`).
 */
export function toYahooSymbol(raw: string): string {
  const bare = stripExchangePrefix(raw);
  if (!bare) return "";
  // Known dual-listed market suffixes stay as `BASE.XX`.
  if (/^[A-Z0-9]{1,10}\.[A-Z]{2,3}$/.test(bare)) return bare;
  // US preferred / share-class dots → Yahoo hyphen form.
  return bare.replace(/\./g, "-");
}
