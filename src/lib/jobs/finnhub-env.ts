/**
 * Finnhub credentials for NYSE listing / quote enrichment.
 * Soft-fail when unset — UI shows an empty state instead of crashing.
 */
export function getFinnhubApiKey(): string | null {
  const key = process.env.FINNHUB_API_KEY?.trim();
  return key || null;
}

export function isFinnhubConfigured(): boolean {
  return getFinnhubApiKey() !== null;
}
