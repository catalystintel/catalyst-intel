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

  let minImpact: number | undefined;
  if (typeof raw.minImpact === "number" && Number.isFinite(raw.minImpact)) {
    minImpact = Math.max(0, Math.min(100, Math.round(raw.minImpact)));
  }

  return {
    ...(categories.length > 0 ? { categories } : {}),
    ...(sessions && sessions.length > 0 ? { sessions } : {}),
    ...(minImpact !== undefined ? { minImpact } : {}),
  };
}

export function normalizeTicker(raw: string): string | null {
  const t = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-]/g, "");
  if (!t || t.length > 12) return null;
  return t;
}
