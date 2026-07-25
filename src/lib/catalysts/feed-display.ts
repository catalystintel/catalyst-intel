import {
  CATEGORY_LABELS,
  extractSecItemBlurb,
  isSecCatalogHeadline,
  SEC_ITEM_HEADLINE_LABELS,
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

/** Other short taxonomy headlines that need company context on the tape. */
const GENERIC_EVENT_HEADLINES = new Set([
  ...SEC_ITEM_HEADLINE_LABELS,
  "form 4 insider transaction",
  "insider buy (form 4)",
  "insider sell (form 4)",
  "form 4 insider buy & sell",
  "beneficial ownership (13d)",
  "beneficial ownership (13g)",
  "prospectus / offering (424b)",
  "shelf registration (s-3)",
  "8-k filing",
  "filing",
  "earnings calendar",
  "fda catalyst",
  "trading halt",
  "halt resumed",
]);

function isGenericEventHeadline(text: string): boolean {
  const t = normalizeDisplayText(text).toLowerCase();
  if (!t) return false;
  if (GENERIC_EVENT_HEADLINES.has(t)) return true;
  return isSecCatalogHeadline(t);
}

/** Company / ticker subject for composing richer tape titles. */
function tapeSubject(c: FeedCatalyst): string | null {
  const company = normalizeDisplayText(c.companyName ?? "");
  if (company) {
    // Drop filing-title chrome: "ACME CORP — 8-K filing"
    const stripped = company
      .replace(
        /\s*[—–\-]\s*(?:\d+-?[A-Z]|8-?K|Form\s*4|S-3|424B|SC\s*13).*$/i,
        "",
      )
      .trim();
    if (stripped.length >= 2) return stripped;
    return company;
  }
  const ticker = c.ticker?.trim().toUpperCase();
  return ticker || null;
}

export type TitleLineOptions = {
  /**
   * Max chars for SEC Atom item blurbs. Tape rows stay short (~110);
   * hover tooltips pass a higher cap so the full notice is readable.
   */
  maxBlurbChars?: number;
};

/**
 * Primary title cell — company + what happened, not a bare taxonomy chip.
 * Prefers real news headlines; for SEC catalog labels, compose
 * `Company — official item blurb` (or trader label) so the wide Title column
 * carries a usable event summary.
 */
/**
 * Ground-rule API titles are stored on `title` (and usually mirrored on
 * `headline`). Prefer them over generic taxonomy chips so the tape shows
 * `Halts (…)` / `FDA Approval - …` / `Earnings Report Qn - …`.
 */
function prefersStoredGroundRuleTitle(c: FeedCatalyst, title: string): boolean {
  if (!title || looksLikeSourceLabel(title)) return false;
  if (/^Halts\s*\(/i.test(title)) return true;
  if (/^FDA Approval\s*-/i.test(title)) return true;
  if (/^Earnings Report\s+Q/i.test(title)) return true;

  if (c.sourceProvider === "nasdaq-halts") return true;
  if (c.type === "FDA Approval" || c.subcategory === "openfda_approval") {
    return true;
  }
  if (
    c.sourceProvider === "finnhub" &&
    c.eventCategory === "earnings" &&
    /earnings report/i.test(title)
  ) {
    return true;
  }
  return false;
}

export function titleLine(
  c: FeedCatalyst,
  options: TitleLineOptions = {},
): string {
  const maxBlurbChars = options.maxBlurbChars ?? 110;
  const headline = normalizeDisplayText(c.headline ?? "");
  const title = normalizeDisplayText(c.title ?? "");
  const subject = tapeSubject(c);

  if (prefersStoredGroundRuleTitle(c, title)) {
    return stripSourceNames(title) || title;
  }

  // Real news / wire copy wins when it is not a publisher or generic chip.
  if (
    headline &&
    !looksLikeSourceLabel(headline) &&
    !isGenericEventHeadline(headline)
  ) {
    return stripSourceNames(headline) || headline;
  }

  // Generic SEC / calendar event — enrich with company + filing blurb.
  if (headline && isGenericEventHeadline(headline)) {
    const primaryCode =
      c.items.find((i) => i.label.toLowerCase() === headline.toLowerCase())
        ?.code ??
      c.items[0]?.code ??
      null;
    const blurb =
      extractSecItemBlurb(c.summary, primaryCode, maxBlurbChars) ||
      stripSourceNames(headline) ||
      headline;
    if (subject) {
      // Avoid "ACME — ACME — Earnings…" when blurb somehow repeats subject.
      if (blurb.toLowerCase().startsWith(subject.toLowerCase())) {
        return blurb;
      }
      return `${subject} — ${blurb}`;
    }
    return blurb;
  }

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

  // Filing title "ACME — 8-K filing" with no usable headline: prefer subject + detail.
  if (
    cleaned &&
    subject &&
    /(?:8-?K|Form\s*4|S-3|424B|SC\s*13).*filing$/i.test(cleaned)
  ) {
    const event =
      (c.items[0] &&
        extractSecItemBlurb(c.summary, c.items[0].code, maxBlurbChars)) ||
      c.items[0]?.label ||
      null;
    if (event) return `${subject} — ${event}`;
    return cleaned;
  }

  if (cleaned && !looksLikeSourceLabel(cleaned)) return cleaned;
  if (title && !looksLikeSourceLabel(title))
    return stripSourceNames(title) || title;
  return cleaned || title || c.type;
}

/** Full filing blurb for hover — same composition as {@link titleLine}, less cut. */
export function titleTooltipLine(c: FeedCatalyst): string {
  return titleLine(c, { maxBlurbChars: 480 });
}

/**
 * Live-tape search: match ticker, company name, filing title, and the
 * displayed title line (headline-first) case-insensitively.
 */
export function matchesFeedSearchQuery(
  c: FeedCatalyst,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const fields = [c.ticker, c.companyName, c.title, c.headline, titleLine(c)];
  return fields.some((field) => (field ?? "").toLowerCase().includes(q));
}

/** Human-readable Event cell labels for known subcategories. */
const SUBCATEGORY_LABELS: Record<string, string> = {
  insider_buy: "Insider buy",
  insider_sell: "Insider sell",
  form4_mixed: "Mixed Form 4",
  form4: "Form 4",
  upgrade: "Upgrade",
  downgrade: "Downgrade",
  price_target: "Price target",
  analyst_rating: "Analyst rating",
  recommendation_trend: "Recommendation trend",
  ipo: "IPO",
  ipo_priced: "IPO priced",
  ipo_filed: "IPO filed",
  ipo_withdrawn: "IPO withdrawn",
  ipo_news: "IPO news",
  benzinga_wire: "Benzinga Wire",
  halt_resumed: "Halt resumed",
  halt: "Trading halt",
  bmo: "Before market open",
  amc: "After market close",
};

/** Event cell: subcategory when present, else type / category. */
export function eventLabel(c: FeedCatalyst): string {
  const sub = c.subcategory?.trim();
  if (sub && SUBCATEGORY_LABELS[sub]) return SUBCATEGORY_LABELS[sub];
  if (sub) return sub.replace(/_/g, " ");
  if (c.type?.trim()) return c.type.trim();
  if (c.eventCategory && c.eventCategory in CATEGORY_LABELS) {
    return CATEGORY_LABELS[c.eventCategory as EventCategoryKey];
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
