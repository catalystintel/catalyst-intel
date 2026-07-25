/**
 * Publisher / source label for a News Feed headline.
 */

import type { NewsHeadline } from "@/lib/catalysts/news-feed-query";

export function newsSourceLabel(h: NewsHeadline): string {
  if (
    h.type === "Wire" ||
    h.subcategory === "benzinga_wire" ||
    /benzinga wire/i.test(h.headline ?? "")
  ) {
    return "Wire";
  }
  if (h.type === "Company News") return h.headline?.trim() || "Company news";
  if (h.headline?.trim()) return h.headline.trim();
  if (h.sourceProvider === "polygon") return "Polygon";
  if (h.sourceProvider === "finnhub") return "Finnhub";
  return h.type || "News";
}
