import type { WatchlistCriteria } from "@/db/schema";
import { isFeedFormFilter } from "@/lib/catalysts/feed-form-filters";
import { isEventCategoryKey } from "@/lib/catalysts/taxonomy";

function stringArray(
  value: unknown,
  transform: (v: string) => string,
  max = 40,
): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of value) {
    if (typeof v !== "string") continue;
    const t = transform(v.trim());
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Coerces untrusted JSON into a typed, size-bounded `WatchlistCriteria`
 * (mirrors `normalizeAlertConditions` in lib/alerts/normalize.ts).
 */
export function normalizeWatchlistCriteria(value: unknown): WatchlistCriteria {
  if (typeof value !== "object" || value === null) return {};
  const raw = value as Record<string, unknown>;

  const symbols = stringArray(raw.symbols, (s) => s.toUpperCase());
  const categories = stringArray(raw.categories, (s) => s).filter(
    isEventCategoryKey,
  );
  const forms = stringArray(raw.forms, (s) => s).filter(isFeedFormFilter);
  const tags = stringArray(raw.tags, (s) => s.toLowerCase(), 60);
  const sources = stringArray(raw.sources, (s) => s.toLowerCase());
  const q =
    typeof raw.q === "string" && raw.q.trim()
      ? raw.q.trim().slice(0, 100)
      : undefined;

  return {
    ...(symbols.length > 0 ? { symbols } : {}),
    ...(categories.length > 0 ? { categories } : {}),
    ...(forms.length > 0 ? { forms } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(sources.length > 0 ? { sources } : {}),
    ...(q ? { q } : {}),
  };
}
