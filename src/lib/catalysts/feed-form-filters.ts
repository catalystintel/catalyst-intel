/**
 * Client-safe feed form buckets (no DB imports).
 */

export const FEED_FORM_FILTERS = [
  "8-K",
  "424B",
  "4",
  "S-3",
  "13D",
  "13G",
  "other",
] as const;

export type FeedFormFilter = (typeof FEED_FORM_FILTERS)[number];

export const FEED_FORM_LABELS: Record<FeedFormFilter, string> = {
  "8-K": "8-K",
  "424B": "424B",
  "4": "Form 4",
  "S-3": "S-3",
  "13D": "13D",
  "13G": "13G",
  other: "Other",
};

export function isFeedFormFilter(value: string): value is FeedFormFilter {
  return (FEED_FORM_FILTERS as readonly string[]).includes(value);
}

export function formBucketFromType(
  type: string | null | undefined,
): FeedFormFilter {
  const t = (type ?? "").trim().toUpperCase();
  if (!t) return "other";
  if (t.startsWith("8-K") || t === "8K") return "8-K";
  if (t.startsWith("424B")) return "424B";
  if (t === "4" || t.startsWith("4/")) return "4";
  if (t.startsWith("S-3")) return "S-3";
  if (t.includes("13D")) return "13D";
  if (t.includes("13G")) return "13G";
  return "other";
}
