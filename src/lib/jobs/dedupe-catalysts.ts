/**
 * Cross-source near-duplicate detection for the Live tape.
 *
 * Same story often arrives from SEC + Finnhub/Polygon (and cluster-events
 * later collapses related rows). This module provides pure helpers for:
 * - title normalization / similarity
 * - provider preference (PR wire favored over other vendors on duplicates)
 * - deciding whether a candidate should skip ingest
 */

/** Look back this far when matching near-duplicates at ingest. */
export const DEDUPE_WINDOW_MINUTES = 90;

/** Jaccard token overlap at/above this counts as the same story. */
export const TITLE_SIMILARITY_THRESHOLD = 0.72;

/**
 * Higher = prefer as the tape primary when stories collide.
 * PR wire is favored over every other vendor for duplicate events (free RT
 * press path). SEC/halts still win only when titles do not near-match.
 */
const PROVIDER_RANK: Record<string, number> = {
  "pr-wire": 110,
  "sec-edgar": 100,
  "nasdaq-halts": 95,
  "macro-calendar": 90,
  openfda: 85,
  clinicaltrials: 80,
  finnhub: 60,
  polygon: 50,
  form4api: 10,
};

export function providerPreference(
  provider: string | null | undefined,
): number {
  if (!provider) return 0;
  return PROVIDER_RANK[provider.toLowerCase().trim()] ?? 40;
}

/** Strip punctuation / source chrome so titles compare cleanly. */
export function normalizeDedupeTitle(
  ...texts: Array<string | null | undefined>
): string {
  for (const text of texts) {
    const raw = text?.replace(/\s+/g, " ").trim();
    if (!raw) continue;
    const normalized = raw
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(
        /\b(?:sec edgar|finnhub|polygon|benzinga|reuters|bloomberg|pr newswire|business wire|globe newswire|rtpr|pr wire)\b/g,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();
    if (normalized.length >= 4) return normalized;
  }
  return "";
}

function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const part of text.split(" ")) {
    if (part.length < 2) continue;
    // Drop ultra-common glue that inflates overlap.
    if (
      part === "the" ||
      part === "and" ||
      part === "for" ||
      part === "with" ||
      part === "from"
    ) {
      continue;
    }
    out.add(part);
  }
  return out;
}

/** Jaccard similarity on normalized title tokens (0–1). */
export function titleSimilarity(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const na = normalizeDedupeTitle(a);
  const nb = normalizeDedupeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ta = tokens(na);
  const tb = tokens(nb);
  if (ta.size === 0 || tb.size === 0) return 0;

  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection++;
  }
  const union = ta.size + tb.size - intersection;
  if (union <= 0) return 0;

  // Also treat containment of a long phrase as a near-match.
  if (na.includes(nb) || nb.includes(na)) {
    const shorter = Math.min(na.length, nb.length);
    if (shorter >= 24) return Math.max(intersection / union, 0.85);
  }

  return intersection / union;
}

export function areNearDuplicateTitles(
  a: string | null | undefined,
  b: string | null | undefined,
  threshold: number = TITLE_SIMILARITY_THRESHOLD,
): boolean {
  return titleSimilarity(a, b) >= threshold;
}

/** Stable fingerprint for symbol + normalized title (ingest skip key). */
export function contentFingerprint(
  symbol: string | null | undefined,
  ...titleParts: Array<string | null | undefined>
): string | null {
  const t = symbol?.trim().toUpperCase();
  const title = normalizeDedupeTitle(...titleParts);
  if (!t || !title) return null;
  return `${t}|${title}`;
}

export interface DedupeCandidate {
  symbol?: string | null;
  title: string;
  headline?: string | null;
  provider: string;
  eventCategory?: string | null;
  timestamp?: string | null;
}

export interface DedupeExisting {
  id: number;
  title: string;
  headline?: string | null;
  provider: string;
  eventCategory?: string | null;
  timestamp: string;
  impactScore?: number | null;
}

/**
 * True when `candidate` is a worse (or equal) retelling of an existing row
 * for the same symbol inside the dedupe window — skip ingest.
 * Better-source arrivals (e.g. SEC after a wire) are allowed through so
 * clustering can promote them.
 */
export function shouldSkipAsDuplicate(
  candidate: DedupeCandidate,
  existing: DedupeExisting[],
  options?: { windowMinutes?: number; nowMs?: number },
): { skip: boolean; reason: string; matchedId?: number } {
  const symbol = candidate.symbol?.trim().toUpperCase();
  if (!symbol || existing.length === 0) {
    return { skip: false, reason: "no symbol or no peers" };
  }

  const windowMs =
    (options?.windowMinutes ?? DEDUPE_WINDOW_MINUTES) * 60 * 1000;
  const nowMs = options?.nowMs ?? Date.now();
  const candidateTs = candidate.timestamp
    ? Date.parse(candidate.timestamp)
    : nowMs;
  const candidateScore = providerPreference(candidate.provider);

  for (const row of existing) {
    const rowTs = Date.parse(row.timestamp);
    if (Number.isNaN(rowTs)) continue;
    if (Math.abs(candidateTs - rowTs) > windowMs) continue;

    const titleMatch =
      areNearDuplicateTitles(candidate.title, row.title) ||
      areNearDuplicateTitles(candidate.title, row.headline) ||
      areNearDuplicateTitles(candidate.headline, row.title) ||
      areNearDuplicateTitles(candidate.headline, row.headline);

    const categoryMatch =
      Boolean(candidate.eventCategory) &&
      candidate.eventCategory === row.eventCategory &&
      // Category alone is weak for busy names — require some title overlap.
      titleSimilarity(
        candidate.headline ?? candidate.title,
        row.headline ?? row.title,
      ) >= 0.45;

    if (!titleMatch && !categoryMatch) continue;

    const existingScore = providerPreference(row.provider);
    if (candidateScore > existingScore) {
      // Prefer inserting the better source; clustering will hide the weaker.
      continue;
    }

    return {
      skip: true,
      reason: `Near-duplicate of #${row.id} (${row.provider}) — keep preferred source`,
      matchedId: row.id,
    };
  }

  return { skip: false, reason: "no near-duplicate" };
}

/**
 * Pick the best primary among clustered members: impact first, then
 * provider preference, then earliest id (stable).
 */
export function pickClusterPrimary<
  T extends {
    id: number;
    impactScore: number | null;
    provider?: string | null;
  },
>(members: T[]): T {
  return members.reduce((best, row) => {
    const bestImpact = best.impactScore ?? 0;
    const rowImpact = row.impactScore ?? 0;
    if (rowImpact > bestImpact) return row;
    if (rowImpact < bestImpact) return best;

    const bestProv = providerPreference(best.provider);
    const rowProv = providerPreference(row.provider);
    if (rowProv > bestProv) return row;
    if (rowProv < bestProv) return best;

    return row.id < best.id ? row : best;
  });
}
