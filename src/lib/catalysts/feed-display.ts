import {
  CATEGORY_LABELS,
  type EventCategoryKey,
} from "@/lib/jobs/parse-8k-items";
import { benzingaPanelForCategory } from "@/lib/catalysts/benzinga-analogs";
import type { FeedCatalyst } from "@/lib/catalysts/feed-catalyst";

export interface SourceDisplay {
  name: string;
  meta: string;
  initial: string;
  tone: "sec" | "wire" | "generic";
}

const PROVIDER_DISPLAY: Record<string, Omit<SourceDisplay, "meta">> = {
  "sec-edgar": { name: "SEC EDGAR", initial: "S", tone: "sec" },
  "nasdaq-halts": { name: "Nasdaq Halts", initial: "N", tone: "generic" },
  "macro-calendar": { name: "Macro", initial: "M", tone: "generic" },
  finnhub: { name: "Finnhub", initial: "F", tone: "generic" },
  polygon: { name: "Polygon", initial: "P", tone: "generic" },
  openfda: { name: "openFDA", initial: "O", tone: "generic" },
  clinicaltrials: { name: "ClinicalTrials", initial: "C", tone: "generic" },
  form4api: { name: "Form4API", initial: "4", tone: "generic" },
};

/**
 * Maps a catalyst's provider / filing type into a display name for muted meta.
 * Polygon rows with Benzinga Wire tagging surface as Wire (not generic Polygon).
 */
export function sourceDisplay(c: FeedCatalyst): SourceDisplay {
  const isWire =
    c.sourceProvider === "polygon" &&
    (/wire/i.test(c.type ?? "") ||
      c.subcategory === "benzinga_wire" ||
      /benzinga wire/i.test(c.headline ?? ""));

  if (isWire) {
    const meta =
      [c.type?.trim() || "Wire", c.ticker?.trim()]
        .filter(Boolean)
        .join(" · ") || "Wire";
    return { name: "Benzinga Wire", meta, initial: "B", tone: "wire" };
  }

  const known = c.sourceProvider
    ? PROVIDER_DISPLAY[c.sourceProvider]
    : undefined;
  const name = known?.name ?? (c.sourceProvider?.trim() || "Unknown");
  const initial = known?.initial ?? (name.charAt(0).toUpperCase() || "?");
  const panel = benzingaPanelForCategory(c.eventCategory);
  const meta =
    [c.type?.trim(), c.ticker?.trim(), panel && !c.ticker ? panel : null]
      .filter(Boolean)
      .join(" · ") || "Source";
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

/**
 * Known provider / wire labels that must never appear as the title cell.
 * News ingest often stores publisher in `headline` and the real story in `title`.
 */
const SOURCE_DISPLAY_NAMES = [
  ...Object.values(PROVIDER_DISPLAY).map((p) => p.name),
  "Benzinga",
  "Benzinga Wire",
  "SEC",
  "EDGAR",
  "Massive",
  "Yahoo",
  "Reuters",
  "Bloomberg",
  "CNBC",
  "MarketWatch",
  "Seeking Alpha",
  "Company news",
  "Market News",
];

const SOURCE_NAME_RE = new RegExp(
  [
    "SEC\\s*EDGAR",
    "SEC",
    "EDGAR",
    "Finnhub",
    "Benzinga(?:\\s+Wire)?",
    "openFDA",
    "Polygon",
    "Massive",
    "Nasdaq\\s+Halts?",
    "ClinicalTrials(?:\\.gov)?",
    "Form4API",
    "Macro(?:\\s+Calendar)?",
    "Yahoo",
    "Reuters",
    "Bloomberg",
    "CNBC",
    "MarketWatch",
    "Seeking\\s+Alpha",
  ].join("|"),
  "i",
);

function normalizeDisplayText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** True when the whole string is essentially a source / publisher label. */
export function looksLikeSourceLabel(text: string): boolean {
  const t = normalizeDisplayText(text);
  if (!t) return false;
  const lower = t.toLowerCase();
  if (SOURCE_DISPLAY_NAMES.some((name) => name.toLowerCase() === lower)) {
    return true;
  }
  // Entire token is a known source (not a longer headline that merely mentions one)
  return new RegExp(`^(?:${SOURCE_NAME_RE.source})$`, "i").test(t);
}

/**
 * Strip provider prefixes/suffixes from a displayed title
 * (e.g. "Foo — SEC EDGAR", "Finnhub: Foo", "Bar — SEC").
 */
export function stripSourceNames(text: string): string {
  let out = normalizeDisplayText(text);
  if (!out) return out;

  // Leading "Source: …" / "Source — …"
  out = out.replace(
    new RegExp(`^(?:${SOURCE_NAME_RE.source})\\s*[:—–\\-]\\s*`, "i"),
    "",
  );
  // Trailing "… — Source" / "… | Source" / "… - Source"
  out = out.replace(
    new RegExp(`\\s*[—–\\-|]\\s*(?:${SOURCE_NAME_RE.source})\\s*$`, "i"),
    "",
  );
  // Bare trailing source token after whitespace
  out = out.replace(
    new RegExp(`\\s+(?:${SOURCE_NAME_RE.source})\\s*$`, "i"),
    "",
  );

  out = normalizeDisplayText(out);
  return out || normalizeDisplayText(text);
}

/**
 * Primary title cell — real story text, never a source/publisher label.
 * Prefers non-source headline, then title; always strips provider chrome.
 */
export function titleLine(c: FeedCatalyst): string {
  const headline = normalizeDisplayText(c.headline ?? "");
  const title = normalizeDisplayText(c.title ?? "");

  let raw = "";
  if (headline && !looksLikeSourceLabel(headline)) {
    raw = headline;
  } else if (title) {
    raw = title;
  } else if (headline) {
    raw = headline;
  } else {
    raw = c.type;
  }

  const cleaned = stripSourceNames(raw);
  if ((!cleaned || looksLikeSourceLabel(cleaned)) && title && title !== raw) {
    const fromTitle = stripSourceNames(title);
    if (fromTitle && !looksLikeSourceLabel(fromTitle)) return fromTitle;
  }

  if (cleaned && !looksLikeSourceLabel(cleaned)) return cleaned;
  if (title && !looksLikeSourceLabel(title))
    return stripSourceNames(title) || title;
  return cleaned || title || c.type;
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
