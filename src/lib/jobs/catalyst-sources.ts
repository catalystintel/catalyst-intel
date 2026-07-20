/** Catalyst ingest source ids — safe to import from client components. */
export const CATALYST_SOURCE_IDS = [
  "sec-edgar",
  "nasdaq-halts",
  "finnhub",
  "polygon-news",
  "polygon-prices",
  "openfda",
  "clinicaltrials",
  "form4api",
] as const;

export type CatalystSourceId = (typeof CATALYST_SOURCE_IDS)[number];

export function isCatalystSourceId(value: string): value is CatalystSourceId {
  return (CATALYST_SOURCE_IDS as readonly string[]).includes(value);
}
