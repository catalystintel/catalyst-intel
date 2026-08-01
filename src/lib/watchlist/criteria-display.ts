import type { WatchlistCriteria } from "@/db/schema";
import { FEED_FORM_LABELS } from "@/lib/catalysts/feed-form-filters";
import {
  CATEGORY_LABELS,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";

export interface CriteriaChip {
  key: string;
  label: string;
  kind: "symbol" | "category" | "form" | "tag" | "source" | "text";
}

/** `category:earnings` → "Category: earnings" — human label for a namespaced tag. */
export function tagLabel(tag: string): string {
  const [ns, ...rest] = tag.split(":");
  if (rest.length === 0) return tag;
  return `${ns.charAt(0).toUpperCase()}${ns.slice(1)}: ${rest.join(":")}`;
}

/** Flattens criteria into display chips, in scan order (who → what → how). */
export function criteriaChips(criteria: WatchlistCriteria): CriteriaChip[] {
  const chips: CriteriaChip[] = [];
  for (const symbol of criteria.symbols ?? []) {
    chips.push({ key: `symbol:${symbol}`, label: symbol, kind: "symbol" });
  }
  for (const category of criteria.categories ?? []) {
    chips.push({
      key: `category:${category}`,
      label: CATEGORY_LABELS[category as EventCategoryKey] ?? category,
      kind: "category",
    });
  }
  for (const form of criteria.forms ?? []) {
    chips.push({
      key: `form:${form}`,
      label:
        FEED_FORM_LABELS[form as keyof typeof FEED_FORM_LABELS] ??
        `Form ${form}`,
      kind: "form",
    });
  }
  for (const tag of criteria.tags ?? []) {
    chips.push({ key: `tag:${tag}`, label: tagLabel(tag), kind: "tag" });
  }
  for (const source of criteria.sources ?? []) {
    chips.push({ key: `source:${source}`, label: source, kind: "source" });
  }
  if (criteria.q?.trim()) {
    chips.push({
      key: `q:${criteria.q}`,
      label: `“${criteria.q}”`,
      kind: "text",
    });
  }
  return chips;
}

/** One-line "what this rule matches" summary for compact rows. */
export function criteriaSummary(criteria: WatchlistCriteria): string {
  const chips = criteriaChips(criteria);
  if (chips.length === 0) return "No filters";
  return chips.map((c) => c.label).join(" · ");
}

export function isCriteriaEmpty(criteria: WatchlistCriteria): boolean {
  return criteriaChips(criteria).length === 0;
}
