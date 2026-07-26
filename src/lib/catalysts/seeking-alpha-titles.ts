/**
 * Seeking Alpha (SeekingAlpha / SeekAlpha) tape titles.
 * Prefer catalyst-style `{Company} - {takeaway}` over clickbait SEO headlines.
 */

import { resolveDisplayCompanyName } from "@/lib/catalysts/catalyst-titles";

const SA_SOURCE_RE = /^seeking\s*alpha$/i;
const SA_URL_RE = /seekingalpha\.com/i;

/** True when a publisher / headline field names Seeking Alpha. */
export function isSeekingAlphaSource(text: string | null | undefined): boolean {
  const t = text?.replace(/\s+/g, " ").trim() ?? "";
  if (!t) return false;
  if (SA_SOURCE_RE.test(t)) return true;
  // Finnhub often stores "SeekingAlpha" with no space.
  return /^seekingalpha$/i.test(t.replace(/\s+/g, ""));
}

/** True when this feed row is a Seeking Alpha article. */
export function isSeekingAlphaCatalyst(input: {
  headline?: string | null;
  sourceUrl?: string | null;
  title?: string | null;
}): boolean {
  if (isSeekingAlphaSource(input.headline)) return true;
  if (input.sourceUrl && SA_URL_RE.test(input.sourceUrl)) return true;
  // Rare: publisher leaked into the story title.
  if (input.title && /\bseeking\s*alpha\b/i.test(input.title)) return true;
  return false;
}

export type SeekingAlphaTitleInput = {
  title: string | null | undefined;
  summary?: string | null;
  companyName?: string | null;
  symbol?: string | null;
  eventCategory?: string | null;
  subcategory?: string | null;
};

type ContentKind =
  | "upgrade"
  | "downgrade"
  | "price_target"
  | "earnings"
  | "fda"
  | "offering"
  | "clinical"
  | "ma"
  | "bull"
  | "bear"
  | "generic";

function normalizeWs(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Strip SA SEO chrome that traders do not need on the tape. */
export function cleanSeekingAlphaHeadline(
  title: string | null | undefined,
): string {
  let t = normalizeWs(title ?? "");
  if (!t) return "";

  t = t
    .replace(/\bseeking\s*alpha\b/gi, "")
    .replace(/\(\s*rating\s+upgrade\s*\)/gi, "")
    .replace(/\(\s*rating\s+downgrade\s*\)/gi, "")
    .replace(/\(\s*upgrade\s*\)/gi, "")
    .replace(/\(\s*downgrade\s*\)/gi, "")
    .replace(/\(\s*initiation\s*\)/gi, "")
    .replace(/\s*[|·]\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Drop first-person clickbait openers when a company clause follows.
  t = t.replace(
    /^(?:i was wrong about|why i(?:'m| am) (?:buying|selling|bullish|bearish)(?: on)?)\s+/i,
    "",
  );

  return normalizeWs(t);
}

const NOT_A_COMPANY_LEFT =
  /^(?:big tech|wall street|banking|markets?|stocks?|investing|where|why|how|what|earnings|preview|update|week ahead)$/i;

const COMPANY_STOP =
  /\b(?:earnings|preview|update|stock|shares?|raises?|cuts?|upgrad(?:e|es|ed|ing)|downgrad(?:e|es|ed|ing)|faces?|announces?|reports?|files?)\b/i;

/**
 * Pull a company name mentioned in the SA headline when Finnhub/Polygon
 * only stored the ticker (or the wrong related symbol).
 */
export function extractCompanyFromSeekingAlphaHeadline(
  title: string | null | undefined,
): string | null {
  const t = cleanSeekingAlphaHeadline(title);
  if (!t) return null;

  const about = t.match(
    /\babout\s+([A-Z][A-Za-z0-9&.'-]*(?:\s+(?:&|[A-Z][A-Za-z0-9&.'-]*)){0,4})/,
  );
  if (about?.[1]) {
    const name = normalizeWs(about[1]);
    if (!NOT_A_COMPANY_LEFT.test(name) && !COMPANY_STOP.test(name)) {
      return name;
    }
  }

  // `{Company} Stock: …`
  const stockColon = t.match(
    /^([A-Z][A-Za-z0-9&.'-]*(?:\s+(?:&|[A-Z][A-Za-z0-9&.'-]*)){0,3})\s+Stock\s*:\s+/,
  );
  if (stockColon?.[1]) {
    const left = normalizeWs(stockColon[1]);
    if (!NOT_A_COMPANY_LEFT.test(left)) return left;
  }

  // Short `{Company}: …` (1–3 tokens; reject event phrases).
  const colon = t.match(
    /^([A-Z][A-Za-z0-9&.'-]*(?:\s+(?:&|[A-Z][A-Za-z0-9&.'-]*)){0,2})\s*:\s+/,
  );
  if (colon?.[1]) {
    const left = normalizeWs(colon[1]);
    if (!NOT_A_COMPANY_LEFT.test(left) && !COMPANY_STOP.test(left)) {
      return left;
    }
  }

  // `{Company} Earnings …` / `{Ticker} upgrades …`
  const leading = t.match(
    /^([A-Z][A-Za-z0-9&.'-]*(?:\s+(?:&|[A-Z][A-Za-z0-9&.'-]*)){0,3})\s+(?:earnings|stock|shares)\b/i,
  );
  if (leading?.[1]) {
    const left = normalizeWs(leading[1]);
    if (!NOT_A_COMPANY_LEFT.test(left) && !COMPANY_STOP.test(left)) {
      return left;
    }
  }

  return null;
}

function detectKind(input: SeekingAlphaTitleInput): ContentKind {
  const sub = input.subcategory?.trim().toLowerCase() ?? "";
  const cat = input.eventCategory?.trim().toLowerCase() ?? "";
  const text = `${input.title ?? ""} ${input.summary ?? ""}`;

  if (sub === "upgrade" || /\bupgrad(?:e|ed|ing|es)\b/i.test(text)) {
    return "upgrade";
  }
  if (sub === "downgrade" || /\bdowngrad(?:e|ed|ing|es)\b/i.test(text)) {
    return "downgrade";
  }
  if (
    sub === "price_target" ||
    /\b(?:price target|raises pt|cuts pt|pt to \$|target price)\b/i.test(text)
  ) {
    return "price_target";
  }
  if (
    cat === "earnings" ||
    sub === "earnings_news" ||
    /\b(?:earnings|eps|guidance|quarterly results)\b/i.test(text)
  ) {
    return "earnings";
  }
  if (
    cat === "regulatory" ||
    sub === "fda_news" ||
    /\b(?:fda|pdufa|adcom|bla\b|nda\b|crl\b)\b/i.test(text)
  ) {
    return "fda";
  }
  if (
    cat === "capital" ||
    sub === "offering_news" ||
    /\b(?:offering|dilution|secondary|atm offering|shelf)\b/i.test(text)
  ) {
    return "offering";
  }
  if (
    cat === "clinical" ||
    sub === "clinical_news" ||
    /\b(?:phase [123]|clinical trial|topline|endpoint)\b/i.test(text)
  ) {
    return "clinical";
  }
  if (
    cat === "deals" ||
    sub === "ma_news" ||
    /\b(?:merger|acquisition|acquire[sd]?|takeover|buyout)\b/i.test(text)
  ) {
    return "ma";
  }
  if (
    /\bbull(?:ish)?\s+case\b|\bwhy\s+(?:i(?:'m| am)\s+)?bullish\b/i.test(text)
  ) {
    return "bull";
  }
  if (
    /\bbear(?:ish)?\s+case\b|\bwhy\s+(?:i(?:'m| am)\s+)?bearish\b/i.test(text)
  ) {
    return "bear";
  }
  return "generic";
}

function ratingFromText(text: string): string | null {
  const m = text.match(
    /\b(?:to|as)\s+(strong buy|strong sell|outperform|underperform|overweight|underweight|equal weight|market perform|buy|hold|sell|neutral)\b/i,
  );
  if (!m?.[1]) return null;
  const raw = m[1].toLowerCase();
  return raw
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function priceTargetDirection(text: string): string {
  if (/\b(?:raises?|lifts?|hikes?|boosts?)\b/i.test(text)) return "Raised";
  if (/\b(?:cuts?|lowers?|slashes?|reduces?)\b/i.test(text)) return "Cut";
  return "Update";
}

function resolveSubject(input: SeekingAlphaTitleInput): string | null {
  const fromHeadline = extractCompanyFromSeekingAlphaHeadline(input.title);
  if (fromHeadline) return fromHeadline;

  const name = input.companyName?.replace(/\s+/g, " ").trim();
  const symbol = input.symbol?.trim().toUpperCase() || null;
  if (name && symbol && name.toUpperCase() === symbol) {
    // Finnhub/Polygon often denormalize ticker into companyName — keep ticker.
    return symbol;
  }
  if (name && name.length >= 2) return name;
  return symbol;
}

/**
 * Normalize a remaining SA takeaway for the right-hand side of
 * `{Company} - {takeaway}` (single spaced hyphen).
 */
function normalizeTakeaway(raw: string, company: string | null): string {
  let t = cleanSeekingAlphaHeadline(raw);
  if (!t) return "Market Update";

  // If leftover still starts with `{Company}:`, drop the left side.
  if (company) {
    const escaped = company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t
      .replace(new RegExp(`^${escaped}(?:\\s+Stock)?\\s*[:\\-]\\s*`, "i"), "")
      .trim();
  }
  t = t.replace(/^:\s*/, "").trim();

  // Soften ALL-CAPS noise without inventing new claims.
  if (t === t.toUpperCase() && t.length > 8) {
    t = t.charAt(0) + t.slice(1).toLowerCase();
  }

  // Prefer sentence case after company separator; keep known acronyms later.
  if (t.length > 0) {
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }

  // Collapse leftover colon company separators into spaced hyphens only when
  // we are not already composing company - takeaway ourselves.
  t = t.replace(/\s*:\s*/g, " - ");

  return normalizeWs(t) || "Market Update";
}

function isMarketWideHeadline(title: string): boolean {
  return /^(?:big tech|banking|wall street|markets?|stocks?|where to invest|what to watch|week ahead)/i.test(
    title,
  );
}

const COMPOSED_SA_EVENT_RE =
  /^(Upgraded to .+|Downgraded to .+|Price Target (?:Raised|Cut|Update)|Earnings (?:Week Ahead|Preview|Report|Update)|FDA (?:Catalyst|Approval Update)|Stock Offering|Clinical Trial Update|M&A Update|Bull Case|Bear Case|Analyst Upgrade|Analyst Downgrade)$/i;

/**
 * Seeking Alpha tape title: `{Company} - {clear catalyst takeaway}`.
 * Does not invent facts not present in the headline/summary/classification.
 * Idempotent for titles already rewritten at ingest.
 */
export function formatSeekingAlphaTitle(input: SeekingAlphaTitleInput): string {
  const cleaned = cleanSeekingAlphaHeadline(input.title);
  if (!cleaned) {
    return resolveDisplayCompanyName(input.companyName, input.symbol);
  }

  // Already a market-wide / event-only SA title from a prior rewrite.
  if (COMPOSED_SA_EVENT_RE.test(cleaned)) {
    return cleaned;
  }

  // Already `{Company} - {event}` from ingest — keep company + event phrase.
  const composed = cleaned.match(/^(.+?) - (.+)$/);
  if (composed && COMPOSED_SA_EVENT_RE.test(composed[2])) {
    return `${resolveDisplayCompanyName(composed[1])} - ${composed[2]}`;
  }
  if (
    composed &&
    composed[1].split(/\s+/).length <= 6 &&
    !/^(?:i |why |where |what |how )/i.test(composed[1]) &&
    !isMarketWideHeadline(composed[1])
  ) {
    // Generic cleaned `{Company} - {takeaway}` — pass through.
    return `${resolveDisplayCompanyName(composed[1])} - ${normalizeTakeaway(composed[2], composed[1])}`;
  }

  const kind = detectKind(input);
  const subject = resolveSubject(input);
  const corpus = `${input.title ?? ""} ${input.summary ?? ""}`;

  let event: string;
  switch (kind) {
    case "upgrade": {
      const rating = ratingFromText(corpus);
      event = rating ? `Upgraded to ${rating}` : "Analyst Upgrade";
      break;
    }
    case "downgrade": {
      const rating = ratingFromText(corpus);
      event = rating ? `Downgraded to ${rating}` : "Analyst Downgrade";
      break;
    }
    case "price_target":
      event = `Price Target ${priceTargetDirection(corpus)}`;
      break;
    case "earnings": {
      if (
        /\bpreview\b/i.test(corpus) ||
        /\bwhat (?:traders?|investors?) should watch\b/i.test(corpus)
      ) {
        event = "Earnings Preview";
      } else if (/\bnext week\b|\bweek ahead\b|\bkick off\b/i.test(corpus)) {
        event = "Earnings Week Ahead";
      } else if (/\bbeat|\bmiss|\breport(?:ed|s|ing)?\b/i.test(corpus)) {
        event = "Earnings Report";
      } else {
        event = "Earnings Update";
      }
      break;
    }
    case "fda":
      event = /\bapproval\b/i.test(corpus)
        ? "FDA Approval Update"
        : "FDA Catalyst";
      break;
    case "offering":
      event = "Stock Offering";
      break;
    case "clinical":
      event = "Clinical Trial Update";
      break;
    case "ma":
      event = "M&A Update";
      break;
    case "bull":
      event = "Bull Case";
      break;
    case "bear":
      event = "Bear Case";
      break;
    default:
      event = normalizeTakeaway(cleaned, subject);
      break;
  }

  // Market-wide / thematic pieces: do not force a wrong ticker prefix
  // (Finnhub often attaches an unrelated related= symbol like ABBV).
  if (isMarketWideHeadline(cleaned)) {
    // Earnings calendars → short event label; other themes keep a cleaned
    // headline (avoid "Clinical Trial Update" for "Where To Invest … Biotech").
    if (kind === "earnings") return event;
    return normalizeTakeaway(cleaned, null);
  }

  if (subject) {
    // Avoid `AAPL - AAPL - …` / repeating company in the takeaway.
    if (event.toLowerCase().startsWith(subject.toLowerCase())) {
      return event;
    }
    return `${resolveDisplayCompanyName(subject)} - ${event}`;
  }

  return event;
}
