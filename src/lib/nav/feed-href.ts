/**
 * Live-tape deep links. `c` re-opens the split panel on that catalyst after
 * navigating away (e.g. full article → back to feed).
 */
export function feedHref(opts?: {
  catalystId?: number | null;
  ticker?: string | null;
}): string {
  const params = new URLSearchParams();
  const ticker = opts?.ticker?.trim().toUpperCase();
  if (ticker) params.set("ticker", ticker);
  if (typeof opts?.catalystId === "number" && opts.catalystId > 0) {
    params.set("c", String(opts.catalystId));
  }
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
