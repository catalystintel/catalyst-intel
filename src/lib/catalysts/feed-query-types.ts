/**
 * Client-safe facet / feed query types (no DB).
 */

export interface FeedFacetBucket {
  key: string;
  count: number;
}

export interface FeedFacets {
  categories: FeedFacetBucket[];
  sectors: FeedFacetBucket[];
  forms: FeedFacetBucket[];
  sources: FeedFacetBucket[];
  /** Auto/vendor tag counts over the filtered corpus (see `deriveAutoTags`). */
  tags: FeedFacetBucket[];
}
