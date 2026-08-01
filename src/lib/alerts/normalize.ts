import type { AlertRuleConditions, AlertSession } from "@/db/schema";
import { normalizePlaybookCategories } from "@/lib/catalysts/playbook";

const SESSIONS = new Set<string>(["AH", "PM", "RTH", "any"]);

/**
 * Coerces untrusted JSON into a typed AlertRuleConditions object.
 */
export function normalizeAlertConditions(value: unknown): AlertRuleConditions {
  if (typeof value !== "object" || value === null) return {};
  const raw = value as Record<string, unknown>;

  const categories = normalizePlaybookCategories(raw.categories);
  const sessions = Array.isArray(raw.sessions)
    ? (raw.sessions.filter(
        (s): s is AlertSession => typeof s === "string" && SESSIONS.has(s),
      ) as AlertSession[])
    : undefined;

  // Impact score retired — drop legacy `minImpact` so it never surfaces in UI.
  const watchlistOnly = raw.watchlistOnly === true;

  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .filter((t): t is string => typeof t === "string" && t.trim() !== "")
        .map((t) => t.trim().toLowerCase())
    : undefined;

  return {
    ...(categories.length > 0 ? { categories } : {}),
    ...(sessions && sessions.length > 0 ? { sessions } : {}),
    ...(watchlistOnly ? { watchlistOnly: true } : {}),
    ...(tags && tags.length > 0 ? { tags } : {}),
  };
}

export function normalizeSymbol(raw: string): string | null {
  const t = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, "");
  if (!t || t.length > 12) return null;
  return t;
}
