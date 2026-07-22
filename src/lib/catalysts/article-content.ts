/**
 * Article body + summary helpers for the in-app catalyst reader.
 * Prefers stored vendor text (summary / description / Atom abstract) over
 * scraping arbitrary URLs. Heuristic extractive summary until Groq is wired.
 */

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z0-9"'(])/;

/** Strip simple HTML tags and collapse whitespace. */
export function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build a short 2–3 sentence extractive summary from free text.
 * Falls back to a truncated paragraph when sentence boundaries are weak.
 */
export function extractiveSummary(
  text: string,
  options?: { maxSentences?: number; maxChars?: number },
): string {
  const maxSentences = options?.maxSentences ?? 3;
  const maxChars = options?.maxChars ?? 520;
  const cleaned = stripHtml(text);
  if (!cleaned) return "";

  const sentences = cleaned
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let out =
    sentences.length > 0 ? sentences.slice(0, maxSentences).join(" ") : cleaned;

  if (out.length > maxChars) {
    const cut = out.slice(0, maxChars);
    const lastSpace = cut.lastIndexOf(" ");
    out = `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
  }
  return out;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringField(
  record: Record<string, unknown> | null,
  ...keys: string[]
): string | null {
  if (!record) return null;
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "string" && v.trim()) return stripHtml(v);
  }
  return null;
}

function joinFields(
  parts: Array<string | null | undefined>,
  sep = " · ",
): string | null {
  const cleaned = parts
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  return cleaned.length > 0 ? cleaned.join(sep) : null;
}

export type ArticleBodySource = "raw" | "summary" | "title" | "empty";

export interface ArticleBodyResult {
  body: string;
  source: ArticleBodySource;
}

/**
 * Pull the best available article/filing body from stored raw_sources JSON
 * and catalyst fields. Does not fetch external HTML.
 */
export function extractArticleBody(input: {
  provider?: string | null;
  rawContent?: unknown;
  summary?: string | null;
  title?: string | null;
  headline?: string | null;
}): ArticleBodyResult {
  const provider = input.provider?.trim() || null;
  const raw = asRecord(input.rawContent);
  const storedSummary = input.summary?.trim() ? stripHtml(input.summary) : null;

  let fromRaw: string | null = null;

  switch (provider) {
    case "sec-edgar":
      fromRaw = stringField(raw, "summary", "description");
      break;
    case "nasdaq-halts":
      fromRaw = stringField(raw, "description", "summary", "title");
      break;
    case "polygon":
      fromRaw = stringField(raw, "description", "summary", "title");
      break;
    case "finnhub": {
      const numLabel = (key: string, label: string): string | null => {
        const v = raw?.[key];
        if (v == null || v === "") return null;
        return `${label} ${String(v)}`;
      };
      fromRaw =
        stringField(raw, "summary", "description") ||
        joinFields([
          stringField(raw, "catalyst"),
          stringField(raw, "indication"),
          stringField(raw, "status"),
          numLabel("epsEstimate", "EPS est"),
          numLabel("epsActual", "EPS act"),
          numLabel("revenueEstimate", "Rev est"),
          numLabel("revenueActual", "Rev act"),
        ]);
      break;
    }
    case "openfda": {
      const submissions = Array.isArray(raw?.submissions)
        ? (raw.submissions as unknown[])
        : [];
      const firstSub = asRecord(submissions[0] ?? null);
      fromRaw =
        joinFields([
          stringField(raw, "sponsor_name"),
          stringField(raw, "brand_name"),
          stringField(firstSub, "submission_type", "submission_status"),
          stringField(
            firstSub,
            "submission_class_code_description",
            "submission_class_code",
          ),
        ]) || stringField(raw, "summary", "description");
      break;
    }
    case "clinicaltrials": {
      const proto = asRecord(raw?.protocolSection);
      const idMod = asRecord(proto?.identificationModule);
      const statusMod = asRecord(proto?.statusModule);
      const condMod = asRecord(proto?.conditionsModule);
      const conditions = Array.isArray(condMod?.conditions)
        ? (condMod.conditions as unknown[])
            .filter((c): c is string => typeof c === "string")
            .join(", ")
        : null;
      fromRaw =
        joinFields(
          [
            stringField(idMod, "briefTitle", "officialTitle"),
            stringField(statusMod, "overallStatus"),
            conditions,
          ],
          ". ",
        ) || stringField(raw, "summary", "description");
      break;
    }
    case "form4api":
      fromRaw =
        joinFields([
          stringField(raw, "transactionType", "amendmentType"),
          stringField(raw, "companyName", "company"),
          stringField(raw, "filedAt") ? `Filed ${String(raw?.filedAt)}` : null,
        ]) || stringField(raw, "summary", "description");
      break;
    default:
      fromRaw = stringField(
        raw,
        "summary",
        "description",
        "body",
        "content",
        "abstract",
        "text",
      );
  }

  if (fromRaw && fromRaw.length > 0) {
    return { body: fromRaw, source: "raw" };
  }
  if (storedSummary) {
    return { body: storedSummary, source: "summary" };
  }

  const titleFallback = joinFields([input.headline, input.title], " — ");
  if (titleFallback) {
    return { body: titleFallback, source: "title" };
  }

  return { body: "", source: "empty" };
}

export interface ArticleSummaryResult {
  summary: string;
  /** True when we synthesized text because stored summary was empty/weak. */
  generated: boolean;
}

/**
 * Prefer the stored catalyst.summary; otherwise extract 2–3 sentences from
 * body / title / headline for the in-app reader.
 */
export function resolveArticleSummary(input: {
  summary?: string | null;
  title?: string | null;
  headline?: string | null;
  body?: string | null;
}): ArticleSummaryResult {
  const stored = input.summary?.trim() ? stripHtml(input.summary) : "";
  if (stored.length >= 40) {
    return { summary: extractiveSummary(stored), generated: false };
  }

  const body = input.body?.trim() ? stripHtml(input.body) : "";
  if (body.length >= 40) {
    return { summary: extractiveSummary(body), generated: true };
  }

  if (stored) {
    return { summary: stored, generated: false };
  }

  const fallback = joinFields([input.headline, input.title], " — ") || "";
  if (!fallback) {
    return { summary: "", generated: true };
  }
  return {
    summary: extractiveSummary(fallback, { maxSentences: 2, maxChars: 280 }),
    generated: true,
  };
}

/** Secondary CTA label for the vendor original URL. */
export function originalSourceLabel(provider?: string | null): string {
  switch (provider?.trim()) {
    case "sec-edgar":
      return "Original on SEC EDGAR";
    case "nasdaq-halts":
      return "Original on Nasdaq";
    case "polygon":
      return "Original article";
    case "finnhub":
      return "Original on source";
    case "openfda":
      return "Original on openFDA";
    case "clinicaltrials":
      return "Original on ClinicalTrials.gov";
    case "form4api":
      return "Original Form 4";
    default:
      return "View original source";
  }
}

/**
 * Ensure ingest rows get a usable summary when the vendor only supplied a title.
 * Safe to call during normalize → insert.
 */
export function ensureIngestSummary(input: {
  summary?: string | null;
  title: string;
  headline?: string | null;
  provider?: string | null;
  rawContent?: unknown;
}): string | null {
  const body = extractArticleBody({
    provider: input.provider,
    rawContent: input.rawContent,
    summary: input.summary,
    title: input.title,
    headline: input.headline,
  }).body;
  const resolved = resolveArticleSummary({
    summary: input.summary,
    title: input.title,
    headline: input.headline,
    body,
  });
  return resolved.summary || null;
}
