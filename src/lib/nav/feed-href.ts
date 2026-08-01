import type { WatchlistCriteria } from "@/db/schema";

/**
 * Live-tape deep links. `c` re-opens the split panel on that catalyst after
 * navigating away (e.g. details → back to feed). `criteria` applies a saved
 * "smart" watchlist's full filter combo (see `/watchlist` → Apply to feed).
 */
export function feedHref(opts?: {
  catalystId?: number | null;
  symbol?: string | null;
  criteria?: WatchlistCriteria | null;
}): string {
  const params = new URLSearchParams();
  const symbol = opts?.symbol?.trim().toUpperCase();
  if (symbol) params.set("symbol", symbol);
  if (typeof opts?.catalystId === "number" && opts.catalystId > 0) {
    params.set("c", String(opts.catalystId));
  }
  const criteria = opts?.criteria;
  if (criteria?.symbols?.length)
    params.set("symbols", criteria.symbols.join(","));
  if (criteria?.categories?.length) {
    params.set("categories", criteria.categories.join(","));
  }
  if (criteria?.sources?.length)
    params.set("sources", criteria.sources.join(","));
  if (criteria?.tags?.length) params.set("tags", criteria.tags.join(","));
  if (criteria?.q?.trim()) params.set("q", criteria.q.trim());
  const qs = params.toString();
  return qs ? `/catalyst-feed?${qs}` : "/catalyst-feed";
}

export function parseFeedCatalystId(
  raw: string | string[] | undefined,
): number | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d+$/.test(value)) return undefined;
  const id = Number(value);
  return id > 0 ? id : undefined;
}
