import {
  CATEGORY_LABELS,
  type EventCategoryKey,
} from "@/lib/jobs/parse-8k-items";
import type { FeedCatalyst } from "@/lib/catalysts/feed-catalyst";

export interface SourceDisplay {
  name: string;
  meta: string;
  initial: string;
  tone: "sec" | "generic";
}

const PROVIDER_DISPLAY: Record<string, Omit<SourceDisplay, "meta">> = {
  "sec-edgar": { name: "SEC EDGAR", initial: "S", tone: "sec" },
  "nasdaq-halts": { name: "Nasdaq Halts", initial: "N", tone: "generic" },
  finnhub: { name: "Finnhub", initial: "F", tone: "generic" },
  polygon: { name: "Polygon", initial: "P", tone: "generic" },
  openfda: { name: "openFDA", initial: "O", tone: "generic" },
  clinicaltrials: { name: "ClinicalTrials", initial: "C", tone: "generic" },
  form4api: { name: "Form4API", initial: "4", tone: "generic" },
};

/**
 * Maps a catalyst's provider / filing type into the Source column (name + muted meta).
 */
export function sourceDisplay(c: FeedCatalyst): SourceDisplay {
  const known = c.sourceProvider
    ? PROVIDER_DISPLAY[c.sourceProvider]
    : undefined;
  const name = known?.name ?? (c.sourceProvider?.trim() || "Unknown");
  const initial = known?.initial ?? (name.charAt(0).toUpperCase() || "?");
  const meta =
    [c.type?.trim(), c.ticker?.trim()].filter(Boolean).join(" · ") || "Source";
  return {
    name,
    meta,
    initial,
    tone: known?.tone ?? "generic",
  };
}

/**
 * Sector column: company sector when present, else event category, else type fallback.
 */
export function sectorLabel(c: FeedCatalyst): string {
  const companySector = c.sector?.trim();
  if (companySector) return companySector;
  if (c.eventCategory && c.eventCategory in CATEGORY_LABELS) {
    return CATEGORY_LABELS[c.eventCategory as EventCategoryKey];
  }
  if (c.sourceProvider === "sec-edgar" || /^8-?K$/i.test(c.type)) {
    return "SEC Filings";
  }
  return c.type?.trim() || "Other";
}

/** Primary title cell — headline preferred, then filing title. */
export function titleLine(c: FeedCatalyst): string {
  return c.headline?.trim() || c.title?.trim() || c.type;
}

/** Event cell: subcategory when present, else type / category. */
export function eventLabel(c: FeedCatalyst): string {
  if (c.subcategory?.trim()) {
    return c.subcategory.replace(/_/g, " ");
  }
  if (c.type?.trim()) return c.type.trim();
  if (c.eventCategory && c.eventCategory in CATEGORY_LABELS) {
    return CATEGORY_LABELS[c.eventCategory];
  }
  return "—";
}

/** Stable style key for sector pills (category when known, else generic). */
export function sectorTone(
  c: FeedCatalyst,
): EventCategoryKey | "sector" | "sec" {
  if (c.eventCategory) return c.eventCategory;
  if (c.sector?.trim()) return "sector";
  if (c.sourceProvider === "sec-edgar" || /^8-?K$/i.test(c.type)) return "sec";
  return "other";
}
