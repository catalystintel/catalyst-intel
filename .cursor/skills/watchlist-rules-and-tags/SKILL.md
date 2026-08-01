---
name: watchlist-rules-and-tags
description: >-
  Auto-tag vocabulary (deriveAutoTags), the WatchlistCriteria "rule" shape
  (explicit symbols + dynamic conditions: categories/forms/tags/sources/q),
  the shared criteria->feed-filters mapping (server) and the sanctioned
  client-side mirror (matchesWatchlistCriteria), watchlist templates,
  AI-assisted drafting/refining (OpenRouter), Quiet mode's multi-watchlist
  signal-source model, and how alert rules consume the same tags. Use
  whenever touching src/lib/watchlist/**, src/lib/catalysts/playbook.ts,
  src/lib/jobs/ingest-pipeline.ts tag derivation, src/db/schema.ts
  WatchlistCriteria/AlertRuleConditions/playbookSettings,
  src/components/watchlist-workspace.tsx or watchlist-playbook-panel.tsx,
  feed tag/symbol filters, or the /api/watchlists* / /api/playbook routes.
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
- **Quiet mode** (`lib/catalysts/playbook.ts` → `matchesQuietPlaybook`) — a
  watchlist is one of potentially _many_ selectable "signal sources", not
  the one flat symbol list anymore. See "Quiet mode" section below.
- (Next phase, partially wired) alert rule conditions
  (`AlertRuleConditions.tags`, `lib/alerts/deliver.ts`).

**Do not build a second, parallel filter-matching implementation.** Server-
side, any new axis or matching rule belongs in `feed-query.ts`
(`buildFeedWhere`) and should flow through `criteriaToFeedFilters` for
watchlists. Client-side (rows already in memory, no round trip), the one
sanctioned mirror is `lib/watchlist/match-criteria.ts` →
`matchesWatchlistCriteria` — used by Quiet mode today. Don't write a third,
ad hoc criteria check anywhere else; extend one of these two and keep them
in sync.

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
   5b. `lib/watchlist/match-criteria.ts` (`matchesWatchlistCriteria`) — mirror
   the same predicate client-side so Quiet mode (and any other
   already-in-memory-rows matcher) sees the new axis too. Keep this in sync
   with `buildFeedWhere` by hand; there's no shared codegen for it.
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

## Quiet mode — multi-watchlist signal sources (`lib/catalysts/playbook.ts`)

Quiet mode used to be "flat `watchlist_entries` symbols AND a fixed set of
playbook event-category checkboxes" (both gates ANDed). That's gone. Today:

- A row passes quiet mode if it matches **any** configured signal source —
  the flat "My symbols" list (`watchlist_entries`, still used elsewhere:
  dashboard rail, `AlertRuleConditions.watchlistOnly`, `/api/news?watchlist=1`,
  report scope `"watchlist"` — don't remove it) **or** any saved watchlist
  the user has selected in `playbookSettings.watchlistIds`. Sources are
  OR'd; each selected watchlist's own criteria is still ANDed across its
  own axes (standard `WatchlistCriteria` semantics).
- `playbookSettings.watchlistIds` (JSON array of `watchlists.id`) is the
  live mechanism. `playbookSettings.categories` is legacy/inert for
  matching — kept only so `/watchlist`'s "migrate my old playbook
  categories into a watchlist" button can read a user's old value once and
  convert it into a real (`{ categories: [...] }`) watchlist.
- With **nothing** configured (`watchlistSymbols` empty and no
  `signalWatchlists`), `matchesQuietPlaybook` falls back to
  `DEFAULT_PLAYBOOK_CATEGORIES` so a first-ever Quiet toggle isn't silently
  empty. This fallback is not user-editable — once a user selects even one
  symbol or watchlist, the fallback stops applying (sources.length > 0).
- `/api/playbook` GET/PUT resolve `watchlistIds` → `signalWatchlists`
  (`{id, criteria}[]`) server-side, **scoped to the caller's own
  watchlists** (`resolveSignalWatchlists` in the route) — never trust a
  client-supplied id list without re-checking ownership. PUT treats
  `watchlistIds` and `categories` as independent partial-patch fields (omit
  either and the previous value is kept) so a quiet-mode-only toggle can't
  wipe the other out.
- `live-catalyst-feed.tsx`'s `visible` filter calls `matchesQuietPlaybook`
  with the richer `MatchableCatalyst` shape (symbol, eventCategory, type,
  tags, sourceProvider, companyName, title, headline) — if you add a new
  `WatchlistCriteria` axis, make sure whatever field it needs is passed
  through here too, not just into `matchesWatchlistCriteria`.
- UI: `watchlist-playbook-panel.tsx` (My symbols + Signal watchlists
  checklist + migrate button) and `watchlist-workspace.tsx` (builder +
  saved list) both call `notifyWatchlistChanged()` after mutating a
  watchlist and both subscribe to it — keep that two-way wiring when
  editing either component so the two panels on `/watchlist` stay in sync
  without a full reload.

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
- Add a criteria axis to `feed-query.ts` without mirroring it in
  `match-criteria.ts` (or vice versa) — Quiet mode and the tape's own
  filters would then disagree on what a rule matches.
- Trust a client-supplied `watchlistIds` list in `/api/playbook` without
  re-scoping it to the caller's own `watchlists` rows.
- Revert Quiet mode to ANDing "symbols" and "categories" as the only two
  axes — the whole point of this redesign is that it's N arbitrary,
  OR'd, rule-based sources, not one flat list plus one checkbox set.
