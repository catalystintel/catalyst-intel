/**
 * Strip vendor / wire-house origin labels from text and API payloads so the
 * product never attributes events to Finnhub, Polygon, openFDA, PR Newswire,
 * Business Wire, RTPR, etc. — in the UI or in network JSON.
 */

/** Wire-house / newsroom brands that appear in press bodies and bylines. */
const WIRE_HOUSE_NAMES = [
  "PR Newswire",
  "PRNewswire",
  "Business Wire",
  "BusinessWire",
  "Globe Newswire",
  "GlobeNewswire",
  "GLOBENEWSWIRE",
  "AccessWire",
  "ACCESSWIRE",
  "ACCESS Wire",
] as const;

/** Ingest / product vendor names that must not ship to clients. */
const VENDOR_ORIGIN_NAMES = [
  "RTPR",
  "Finnhub",
  "Polygon",
  "Massive",
  "openFDA",
  "OpenFDA",
  "Benzinga Wire",
  "Benzinga",
  "PR Wire",
  "ClinicalTrials.gov",
  "ClinicalTrials",
  "Form4API",
  "SEC EDGAR",
  "EDGAR",
  "Nasdaq Halts",
  "FMP Econ",
] as const;

const ORIGIN_LABEL_NAMES = [
  ...WIRE_HOUSE_NAMES,
  ...VENDOR_ORIGIN_NAMES,
  "SEC",
] as const;

/** Tags that name a vendor or wire origin (content-type tags stay). */
const ORIGIN_TAGS = new Set(
  [
    "finnhub",
    "polygon",
    "openfda",
    "benzinga",
    "wire",
    "pr_wire",
    "pr-wire",
    "rtpr",
    "clinicaltrials",
    "form4api",
    "sec-edgar",
    "sec",
    "edgar",
    "nasdaq-halts",
    "macro-calendar",
    "fmp-econ-calendar",
    "press-release",
  ].map((t) => t.toLowerCase()),
);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ORIGIN_ALT = ORIGIN_LABEL_NAMES.map(escapeRegExp).join("|");

const ORIGIN_TOKEN_RE = new RegExp(`\\b(?:${ORIGIN_ALT})\\b`, "gi");

/** Dateline markers like `/PRNewswire/ --` or `(BUSINESS WIRE) --`. */
const WIRE_DATELINE_RE =
  /\s*(?:\/\s*(?:PR\s*Newswire|Business\s*Wire|Globe\s*Newswire|Access\s*Wire)\s*\/|\(\s*(?:PR\s*NEWSWIRE|BUSINESS\s*WIRE|GLOBENEWSWIRE|ACCESSWIRE)\s*\))\s*(?:--)?\s*/gi;

/** Standalone publisher lines in press bodies. */
const STANDALONE_PUBLISHER_RE = new RegExp(
  `^\\s*(?:${WIRE_HOUSE_NAMES.map(escapeRegExp).join("|")})\\s*$`,
  "gim",
);

/**
 * Retired product surface: strip impact-score phrases that older wire
 * receipts baked into summaries / snippets (e.g. "Impact score 95").
 */
const IMPACT_SCORE_PHRASE_RE =
  /(?:^|[\s·|,—–-]+)impact\s*scores?\s*[:=]?\s*\d{1,3}(?:\s*\/\s*100)?(?=$|[\s·|,—–.])/gi;

/** Key-fact / snippet lines that are only an impact score. */
const IMPACT_SCORE_LINE_RE =
  /^\s*impact\s*scores?\s*[:=]?\s*\d{1,3}(?:\s*\/\s*100)?\s*$/i;

export function looksLikeOriginLabel(text: string | null | undefined): boolean {
  const t = text?.replace(/\s+/g, " ").trim() ?? "";
  if (!t) return false;
  return new RegExp(`^(?:${ORIGIN_ALT})$`, "i").test(t);
}

/** True when a key-fact label is the retired impact-score field. */
export function isImpactScoreLabel(label: string | null | undefined): boolean {
  const t = label?.replace(/\s+/g, " ").trim() ?? "";
  return /^impact\s*scores?$/i.test(t) || /^tier$/i.test(t);
}

/**
 * Remove wire-house / vendor origin tokens from free text (titles, bodies,
 * summaries). Safe to run repeatedly.
 */
export function scrubOriginMentions(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  let out = value;
  out = out.replace(WIRE_DATELINE_RE, " ");
  out = out.replace(STANDALONE_PUBLISHER_RE, "");
  out = out.replace(ORIGIN_TOKEN_RE, "");
  out = out.replace(IMPACT_SCORE_PHRASE_RE, " ");
  // Drop leftover lines that were only an impact-score fact.
  out = out
    .split("\n")
    .filter((line) => !IMPACT_SCORE_LINE_RE.test(line))
    .join("\n");
  // Collapse leftover punctuation chrome after stripping.
  out = out
    .replace(/^\s*[:—–\-]\s*/g, "")
    .replace(/\s*[|—–]\s*(?=[|—–]|$)/g, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s*·\s*·\s*/g, " · ")
    .replace(/^(?:\s*·\s*)+|(?:\s*·\s*)+$/g, "")
    .trim();
  return out || null;
}

/** Drop tags that name a vendor, wire origin, or retired impact tier. */
export function scrubOriginTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter(
    (t): t is string =>
      typeof t === "string" &&
      t.trim().length > 0 &&
      !ORIGIN_TAGS.has(t.trim().toLowerCase()) &&
      !looksLikeOriginLabel(t) &&
      !/^impact:(?:low|medium|high)$/i.test(t.trim()),
  );
}

/** Map vendor-leaking subcategories to product-safe slugs. */
export function scrubOriginSubcategory(
  subcategory: string | null | undefined,
): string | null {
  const sub = subcategory?.trim() || null;
  if (!sub) return null;
  switch (sub) {
    case "pr_wire":
    case "benzinga_wire":
      return "press_release";
    case "openfda_approval":
      return "fda_approval";
    default:
      return sub;
  }
}

/** Headline that is only a source/publisher label → null. */
export function scrubOriginHeadline(
  headline: string | null | undefined,
): string | null {
  const cleaned = scrubOriginMentions(headline);
  if (!cleaned || looksLikeOriginLabel(cleaned)) return null;
  return cleaned;
}

/**
 * Strip `provider` from historicalImpact JSON (internal ingest provenance).
 */
export function scrubHistoricalImpact(value: unknown): unknown | null {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return value;
  const copy = { ...(value as Record<string, unknown>) };
  delete copy.provider;
  return copy;
}

/** True when a tag or headline token is an origin label we hide. */
export function isOriginTag(tag: string): boolean {
  return ORIGIN_TAGS.has(tag.trim().toLowerCase()) || looksLikeOriginLabel(tag);
}
