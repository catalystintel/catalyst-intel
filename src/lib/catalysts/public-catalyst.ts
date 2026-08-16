/**
 * Shape catalyst rows for browser JSON: no vendor origin fields, no raw
 * blobs, scrubbed text. Server keeps full rows for ingest / admin / title
 * logic before this boundary.
 */

import { isLocalDevUi } from "@/lib/dev/local-dev-ui";
import {
  type FeedCatalyst,
  type RawCatalystRow,
  toFeedCatalyst,
} from "@/lib/catalysts/feed-catalyst";
import { titleLine } from "@/lib/catalysts/feed-display";
import {
  isImpactScoreLabel,
  scrubHistoricalImpact,
  scrubOriginHeadline,
  scrubOriginMentions,
  scrubOriginSubcategory,
  scrubOriginTags,
} from "@/lib/catalysts/sanitize-source-origin";

export type PublicFeedCatalyst = FeedCatalyst;

/**
 * Map a DB / internal row into a client-safe {@link FeedCatalyst}.
 * Omits `sourceProvider` / `sourceUrl` outside local-dev; never includes
 * `rawContent` (keyFacts are extracted first).
 *
 * Applies {@link titleLine} so SSR / API payloads already carry case-engine
 * display titles — the Live tape must not depend on client-only rewrites.
 */
export function toPublicFeedCatalyst(row: RawCatalystRow): PublicFeedCatalyst {
  const includeOrigins = isLocalDevUi();
  const base = toFeedCatalyst({
    ...row,
    title: scrubOriginMentions(row.title) ?? row.title,
    headline: scrubOriginHeadline(row.headline),
    summary: scrubOriginMentions(row.summary),
    tags: scrubOriginTags(row.tags),
    subcategory: scrubOriginSubcategory(row.subcategory) ?? row.subcategory,
    historicalImpact: scrubHistoricalImpact(row.historicalImpact),
    sourceUrl: includeOrigins ? row.sourceUrl : null,
    sourceProvider: includeOrigins ? (row.sourceProvider ?? null) : null,
    // Keep rawContent only long enough for keyFacts extraction inside
    // toFeedCatalyst — callers must not re-attach it to the response.
    rawContent: row.rawContent,
  });

  const keyFacts = base.keyFacts
    .filter((f) => !isImpactScoreLabel(f.label))
    .map((f) => ({
      label: scrubOriginMentions(f.label) ?? f.label,
      value: scrubOriginMentions(f.value) ?? f.value,
    }))
    .filter((f) => f.label.length > 0 && f.value.length > 0);

  const scrubbed: FeedCatalyst = {
    ...base,
    // Impact score retired from the product surface — keep fields for
    // typed shape / DB compat but never ship scores to the client.
    impactScore: null,
    materialityReasons: [],
    title: scrubOriginMentions(base.title) ?? base.title,
    headline: scrubOriginHeadline(base.headline),
    summary: scrubOriginMentions(base.summary),
    tags: scrubOriginTags(base.tags),
    subcategory: scrubOriginSubcategory(base.subcategory),
    historicalImpact: scrubHistoricalImpact(base.historicalImpact),
    sourceUrl: includeOrigins ? base.sourceUrl : null,
    sourceProvider: includeOrigins ? base.sourceProvider : null,
    keyFacts,
  };

  const displayTitle = titleLine(scrubbed);
  return {
    ...scrubbed,
    title: displayTitle,
  };
}

/** Scrub free-text article body / summary before shipping over the wire. */
export function scrubPublicArticleText(
  value: string | null | undefined,
): string {
  return scrubOriginMentions(value) ?? "";
}
