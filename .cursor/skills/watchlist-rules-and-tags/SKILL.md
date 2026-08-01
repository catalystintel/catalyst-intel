---
name: watchlist-rules-and-tags
description: >-
  Auto-tag vocabulary (deriveAutoTags), the WatchlistCriteria "rule" shape
  (explicit symbols + dynamic conditions: categories/forms/tags/sources/q),
  the shared criteria->feed-filters mapping, watchlist templates, AI-assisted
  drafting/refining (OpenRouter), and how alert rules consume the same tags.
  Use whenever touching src/lib/watchlist/**, src/lib/jobs/ingest-pipeline.ts
  tag derivation, src/db/schema.ts WatchlistCriteria/AlertRuleConditions,
  src/components/watchlist-workspace.tsx, feed tag/symbol filters, or the
  /api/watchlists* routes.
---

# Watchlist rules & auto-tags

## Mental model

A **watchlist is a rule**, not just a symbol list: `WatchlistCriteria`
(`src/db/schema.ts`) combines **explicit symbols** and **dynamic conditions**
(event categories, SEC form buckets, tags, vendor sources, free text) —
any subset, ANDed across axes, any-matched within an axis. The exact same
shape and matching engine is used for:

- The Catalyst Feed's own filter panel (`live-catalyst-feed.tsx` /
  `feed-filter-persist.ts` / `feed-query.ts`) — via `symbolFilters` /
  `categoryFilters` / `tagFilters` / `sourceFilters` state.
- Saved "smart" watchlists (`watchlists` table, `/api/watchlists*`,
  `watchlist-workspace.tsx`).
- Watchlist previews (ad-hoc and saved) via
  `lib/watchlist/criteria-to-feed-filters.ts` → `feed-query.ts`.
- (Next phase, partially wired) alert rule conditions
  (`AlertRuleConditions.tags`, `lib/alerts/deliver.ts`).

**Do not build a second, parallel filter-matching implementation.** Any new
axis or matching rule belongs in `feed-query.ts` (`buildFeedWhere`) and
should flow through `criteriaToFeedFilters` for watchlists — not a bespoke
SQL/JS check bolted onto one call site.

## The tag vocabulary (`deriveAutoTags`)

`src/lib/jobs/ingest-pipeline.ts` → `deriveAutoTags()` stamps **every**
catalyst, regardless of vendor, with deterministic namespaced tags, merged
(case-insensitive dedupe, `mergeTags`) with whatever free-form tags the
fetcher already supplies (`fda`, `wire`, `bz:*`, `13d`, …):

| Namespace     | Values                                                    | Source                       |
| ------------- | --------------------------------------------------------- | ---------------------------- |
| `category:*`  | `EventCategoryKey` (see `taxonomy.ts`)                    | `eventCategory`              |
| `form:*`      | lowercased `FeedFormFilter` bucket (e.g. `form:8-k`)      | `formBucketFromType(type)`   |
| `session:*`   | `ah` \| `pm` \| `rth` (omitted when `any`)                | `classifySession(timestamp)` |
| `impact:*`    | `low` \| `medium` \| `high` (thresholds: <40 / <70 / ≥70) | `impactScore`                |
| `sentiment:*` | `bullish` \| `bearish` \| `neutral`                       | vendor sentiment (optional)  |
| `symbol:*`    | lowercased ticker                                         | resolved `symbol` (optional) |

Tags are always **lowercase when filtered/matched** (`tagsSql` in
`feed-query.ts` does `lower(tags) LIKE '%"tag"%'`), but may be stored with
original casing from vendors — never assume stored casing when comparing;
always `.toLowerCase()` both sides.

**If you add a new structured field to `catalysts`** that should be
filterable/combinable (e.g. a new score or classification), prefer adding an
auto-tag namespace over a new bespoke filter axis unless it needs its own
UI affordance (multi-select with facet counts) like categories/forms do.

## `WatchlistCriteria` — extending the schema

Shape lives in `src/db/schema.ts` (comment each field with its value
vocabulary). Today: `symbols`, `categories`, `forms`, `tags`, `sources`, `q`.

Adding a new axis touches **all** of these (miss one and drafts/saves/AI
silently drop the field):

1. `WatchlistCriteria` interface (`db/schema.ts`) — plus the matching
   migration if it's a new DB column elsewhere (see drizzle-migrations
   skill; `watchlists.criteria` itself is just JSON, no migration needed for
   new _criteria_ fields).
2. `normalizeWatchlistCriteria` (`lib/watchlist/normalize-criteria.ts`) —
   validate/coerce/cap the new field; untrusted JSON in, never trust the
   client or the LLM.
3. `criteriaToFeedFilters` (`lib/watchlist/criteria-to-feed-filters.ts`) —
   map onto `FeedQueryFilters` / `buildFeedWhere`.
4. `feed-query.ts` — add the actual SQL predicate + (if it should be a live
   facet like tags/categories) a facet-count function, wired into
   `queryFeedFacets`.
5. `feed-filter-persist.ts` + `live-catalyst-feed.tsx` — panel state,
   persistence, `feedApiQuery` param, chip UI, if the tape itself should
   expose this as a filter (not all criteria axes need a tape UI, but all
   tape filter axes should be expressible as criteria).
6. `lib/watchlist/templates.ts` — update templates only if the new axis
   changes what an existing template should express.
7. `lib/watchlist/ai-draft.ts` — update `SYSTEM_PROMPT`'s field rules so the
   AI drafter knows the new axis exists and its vocabulary. The prompt
   already derives `CATEGORY_LIST` / `FORM_LIST` from `taxonomy.ts` /
   `feed-form-filters.ts` — keep doing that (single source of truth) rather
   than hardcoding lists that can drift.
8. `watchlist-workspace.tsx` — `DraftFields`, `draftToCriteria`,
   `criteriaToDraft`, `criteriaChips`, and a form control if it's
   user-editable.
9. If it should gate alerts too: `AlertRuleConditions` (`db/schema.ts`),
   `normalizeAlertConditions` (`lib/alerts/normalize.ts`), `conditionsMatch`
   (`lib/alerts/deliver.ts`), and the payload built in `auto-fire.ts` /
   `/api/alert-rules/test`.

## AI drafting (`lib/watchlist/ai-draft.ts`)

- Same free OpenRouter provider as on-demand catalyst triage
  (`lib/jobs/llm-provider.ts` / `llm-triage.ts`): `jsonObject: true` first,
  fallback without `response_format`, soft-fail to a calm error string when
  `isOpenRouterConfigured()` is false. Never throw a raw OpenRouter error to
  the client.
- `draftWatchlistWithAI(prompt, existing?)` — passing `existing` (name +
  criteria) turns the call into a **refinement**: the system prompt
  instructs the model to keep what's right and only change what the new
  instruction asks for. The API route (`/api/watchlists/ai-draft`) and the
  builder UI always pass the current draft as `existing` once one exists.
- The model's JSON response is **always** re-run through
  `normalizeWatchlistCriteria` (`parseWatchlistDraftResponse`) — never trust
  LLM output as already-valid `WatchlistCriteria`. An empty criteria after
  normalization ⇒ treat as a failed draft (`null`), not a valid empty rule.
- Rate limit: `RATE_LIMITS.watchlistsAiDraft` (mirrors `catalystsAnalyze` —
  LLM calls are the expensive resource, keep it tight).
- Test the pure parser (`parseWatchlistDraftResponse`) directly with
  hand-written JSON strings, same pattern as `parseTriageResponse` in
  `llm-triage.test.ts` — don't mock `fetch`/OpenRouter for this.

## The symbol-filter gotcha (don't regress this)

`symbolFilters` (exact chip, `inArray(catalysts.symbol, ...)`) and
`symbolQuery` (fuzzy `q`, `LIKE` over symbol/company/title/headline) are
**deliberately separate** fields on `FeedFilterState` / `FeedQueryFilters`.
"Filter tape to SYMBOL" (symbol action menu) and the `?symbol=` deep link
must always populate `symbolFilters`, never `symbolQuery` — that was the
original bug (clicking a symbol just biased the search box instead of
actually filtering). If you add another "jump to this symbol" entry point,
wire it to `symbolFilters`.

## Watchlist templates (`lib/watchlist/templates.ts`)

Pure data, client+server safe (no `server-only` imports). Each template is
a `{ id, name, description, criteria }` starting point users tweak by hand
or hand to the AI drafter as `existingCriteria`. When adding one: prefer
structured `categories`/`forms` over `tags` when an exact taxonomy value
exists; use the `category:*`/`form:*`/`impact:*`/`session:*` tag namespaces
(lowercase) when you need a combinator that structured axes don't express
alone (e.g. "high impact" or "after-hours").

## Never do

- Duplicate `buildFeedWhere`'s predicate logic instead of reusing
  `criteriaToFeedFilters` + `feed-query.ts`.
- Trust client- or LLM-supplied criteria without
  `normalizeWatchlistCriteria`.
- Wire a new "click to filter" affordance to `symbolQuery` instead of
  `symbolFilters`.
- Hardcode category/form lists in a new place instead of importing from
  `taxonomy.ts` / `feed-form-filters.ts`.
- Add a criteria axis without updating the AI system prompt — an axis the
  drafter doesn't know about can never be produced by AI drafting.
