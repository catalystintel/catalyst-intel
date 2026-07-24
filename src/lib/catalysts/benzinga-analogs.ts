/**
 * Map Catalyst Intel taxonomy / SEC form types to Benzinga Pro calendar analogs.
 * Honest product mapping — not a claim of Wire/UOA/Squawk parity.
 */

import type { EventCategoryKey } from "@/lib/catalysts/taxonomy";

/** Benzinga Pro panel / calendar book closest to each event category. */
export const BENZINGA_PANEL_FOR_CATEGORY: Record<EventCategoryKey, string> = {
  earnings: "Calendar — Earnings",
  deals: "Calendar — M&A / Newsfeed",
  management: "Newsfeed / Details",
  capital: "Calendar — Secondary Offerings",
  distress: "Newsfeed",
  restructuring: "Newsfeed",
  governance: "Calendar — SEC Filings",
  disclosure: "Calendar — SEC Filings / Newsfeed",
  trading_halt: "Halts",
  cyber: "Newsfeed / Calendar — SEC Filings",
  insider: "Details — Insiders / Calendar SEC",
  regulatory: "Calendar — FDA",
  clinical: "Calendar — FDA",
  macro: "Calendar — Economics",
  analyst: "Calendar — Analyst Ratings",
  news: "Newsfeed",
  other: "Newsfeed",
};

/** SEC form → Benzinga calendar book (filings path). */
export const BENZINGA_PANEL_FOR_SEC_FORM: Record<string, string> = {
  "8-K": "Calendar — SEC Filings / Newsfeed",
  "4": "Details — Insiders",
  "S-3": "Calendar — Secondary Offerings",
  "424B": "Calendar — Secondary Offerings",
  "13D": "Calendar — M&A / SEC Filings",
  "13G": "Calendar — SEC Filings",
};

export function benzingaPanelForCategory(
  category?: EventCategoryKey | null,
): string | null {
  if (!category) return null;
  return BENZINGA_PANEL_FOR_CATEGORY[category] ?? null;
}

export function benzingaPanelForSecForm(formType: string): string {
  const form = formType.trim().toUpperCase();
  if (form === "4" || form.startsWith("4/")) {
    return BENZINGA_PANEL_FOR_SEC_FORM["4"];
  }
  if (form.startsWith("S-3")) return BENZINGA_PANEL_FOR_SEC_FORM["S-3"];
  if (form.startsWith("424B")) return BENZINGA_PANEL_FOR_SEC_FORM["424B"];
  if (form.includes("13D")) return BENZINGA_PANEL_FOR_SEC_FORM["13D"];
  if (form.includes("13G")) return BENZINGA_PANEL_FOR_SEC_FORM["13G"];
  if (form.startsWith("8-K")) return BENZINGA_PANEL_FOR_SEC_FORM["8-K"];
  return "Calendar — SEC Filings";
}
