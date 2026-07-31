import { normalizeSymbol } from "@/lib/alerts/normalize";

const HEADER_TOKENS = new Set([
  "symbol",
  "symbols",
  "ticker",
  "tickers",
  "stock",
  "stocks",
  "name",
  "company",
]);

/** Reject company names / headers; accept ticker-like tokens only. */
function cellToSymbol(raw: string): string | null {
  const cleaned = raw.replace(/^["']|["']$/g, "").trim();
  if (!cleaned || /\s/.test(cleaned)) return null;
  if (HEADER_TOKENS.has(cleaned.toLowerCase())) return null;
  return normalizeSymbol(cleaned);
}

/**
 * Parse pasted / CSV portfolio text into unique normalized symbols.
 * Accepts commas, semicolons, whitespace, or newlines. Caps at `max`
 * after dedupe. Company-name CSV columns (spaces) are ignored.
 */
export function parsePortfolioSymbols(
  raw: string,
  max = 100,
): { symbols: string[]; skipped: number } {
  const seen = new Set<string>();
  const symbols: string[] = [];
  let skipped = 0;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const cells =
      trimmed.includes(",") || trimmed.includes(";")
        ? trimmed.split(/[,;]/)
        : trimmed.split(/[\s\t]+/);

    // Skip pure header rows (first cell is Symbol/Ticker/…).
    const firstClean = cells[0]?.replace(/^["']|["']$/g, "").trim() ?? "";
    if (HEADER_TOKENS.has(firstClean.toLowerCase())) continue;

    for (const cell of cells) {
      const symbol = cellToSymbol(cell);
      if (!symbol) {
        if (cell.trim()) skipped += 1;
        continue;
      }
      if (seen.has(symbol)) continue;
      seen.add(symbol);
      if (symbols.length >= max) {
        skipped += 1;
        continue;
      }
      symbols.push(symbol);
    }
  }

  return { symbols, skipped };
}
