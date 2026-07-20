/**
 * Finnhub credentials for NYSE listing / quote enrichment and catalyst calendars.
 * Soft-fail when unset — UI shows an empty state instead of crashing.
 */
export { getFinnhubApiKey, isFinnhubConfigured } from "@/lib/jobs/vendor-env";
