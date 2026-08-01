/**
 * Publisher / source label for a News Feed headline.
 * Never names a vendor (Finnhub / Polygon / wire house) — product is the source.
 */

import type { NewsHeadline } from "@/lib/catalysts/news-feed-query";

export function newsSourceLabel(h: NewsHeadline): string {
  if (
    h.type === "Wire" ||
    h.type === "Press Release" ||
    h.subcategory === "benzinga_wire" ||
    h.subcategory === "press_release" ||
    h.subcategory === "pr_wire"
  ) {
    return "Press release";
  }
  if (h.type === "Company News") return "Company news";
  if (h.type === "Market News") return "Market news";
  return h.type || "News";
}
