# Catalyst Intel — API fetch order

Canonical Must → Should order for multi-source ingest
(`POST /api/admin/fetch/all`, Admin “Fetch all”, **cron-job.org** every 1 min in prod).

## Display order (Must → Should)

| #   | Source id           | Label                 | Priority | Runtime phase | What it contributes                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------- | --------------------- | -------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `sec-edgar`         | SEC EDGAR             | Must     | A             | 8-K, Form 4 buy·sell, S-3, 424B, SC 13D/G (needs `SEC_EDGAR_USER_AGENT`)                                                                                                                                                                                                                                                                                                                    |
| 2   | `nasdaq-halts`      | Nasdaq Halts          | Must     | A             | Trading halt / resume events (keyless)                                                                                                                                                                                                                                                                                                                                                      |
| 3   | `macro-calendar`    | Macro calendar        | Must     | A             | CPI / NFP / PPI / FOMC dates (keyless; embedded BLS + Fed schedule)                                                                                                                                                                                                                                                                                                                         |
| 4   | `pr-wire`           | PR wire               | Must     | B             | Keyless public impact board (newest-first; ~60m delay; **upstream** score≥70 floor — free API cannot return lower). No article URLs on free receipts. Maps score/direction/event_type/theme + settled move → impact/sentiment/category/`historicalImpact` + Details extract. Optional `PR_WIRE_API_*` → authenticated firehose + `/a/{id}` body scrape (all scores). Favored on duplicates. |
| 5   | `finnhub`           | Finnhub               | Should   | B             | Earnings + FDA + classified news + recent PT + IPO (`FINNHUB_API_KEY`; soft-skip if unset)                                                                                                                                                                                                                                                                                                  |
| 6   | `openfda`           | openFDA               | Must     | A             | Recent FDA drug approval (AP) submissions (keyless)                                                                                                                                                                                                                                                                                                                                         |
| 7   | `clinicaltrials`    | ClinicalTrials.gov    | Must     | —             | **PAUSED** (not fetched) — CT.gov refreshes ~daily; code kept                                                                                                                                                                                                                                                                                                                               |
| 8   | `polygon-news`      | Polygon news          | Should   | —             | **PAUSED** (not fetched) — Ticker News ≈ hourly, not RT Benzinga; code kept                                                                                                                                                                                                                                                                                                                 |
| 9   | `polygon-prices`    | Polygon prices        | Should   | C             | `historical_impact` from daily aggs (`POLYGON_API_KEY` / `MASSIVE_API_KEY`)                                                                                                                                                                                                                                                                                                                 |
| 10  | `fmp-econ-calendar` | FMP economic calendar | Should   | — (dedicated) | US high-impact econ with estimate/previous/actual (`FMP_API_KEY`). **Not** on 1-min fetch/all — cron-job.org every **10 min** → `POST /api/admin/fetch/fmp-econ-calendar`, or local `npm run cron:fmp-econ`. Soft-skips on missing key / HTTP 402.                                                                                                                                          |

Source of truth in code: `src/lib/jobs/catalyst-sources.ts`
(`CATALYST_SOURCE_IDS`, `CATALYST_SOURCE_CATALOG`, `FETCH_PHASES`).

## Runtime phases (phased parallel)

Execution is **not** fully sequential. Phases run in order A → B → C:

| Phase | Mode       | Sources                                          | Why                                     |
| ----- | ---------- | ------------------------------------------------ | --------------------------------------- |
| **A** | Parallel   | SEC EDGAR, Nasdaq Halts, Macro calendar, openFDA | Keyless Must sources; safe to fan out   |
| **B** | Parallel   | PR wire, Finnhub                                 | Keyed Must/Should; soft-skip when unset |
| **C** | Sequential | Polygon prices                                   | Free-tier REST budget (~5 req/min)      |

`fmp-econ-calendar` is catalogued with `includeInFetchAll: false` so free-tier
FMP quota (~250/day) is not burned by the 1-min orchestrator.

One vendor failure never blocks later sources within a parallel phase
(`Promise.allSettled`). `clinicaltrials` and `polygon-news` remain in the
catalog with `fetchEnabled: false` — Admin can still see them; Fetch all / cron
skip them.

## API response shape

`POST /api/admin/fetch/all` returns:

- `fetchOrder` — full Must→Should catalog (labels, phases, contributes)
- `phases` — phases that actually ran for this request
- `sources` — per-source results in Must→Should order
- `totals` — summed fetched / inserted / skipped / errors

## Status meanings

| Status    | Meaning                                                           |
| --------- | ----------------------------------------------------------------- |
| `ok`      | Job ran; check inserted/skipped/errors counts                     |
| `skipped` | Soft-skip (usually missing optional API key) — not a hard failure |
| `error`   | Hard failure (network, auth, unexpected exception)                |

### Common messages / errors

| Source                            | Typical issue                             | Meaning                                                                                               |
| --------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `form4api`                        | `Intentionally skipped…`                  | Expected always (quality-first); EDGAR Form 4 still ingests; Form4API off to avoid duplicates         |
| `pr-wire`                         | (always configured)                       | Keyless public scrape by default; optional `PR_WIRE_API_KEY` + `PR_WIRE_API_BASE` for full feed       |
| `finnhub`                         | `FINNHUB_API_KEY is not set…`             | Soft-skip; calendars/news not fetched                                                                 |
| `fmp-econ-calendar`               | `FMP_API_KEY is not set…` / HTTP 402      | Soft-skip; dedicated 10-min cron only (not fetch/all)                                                 |
| `clinicaltrials` / `polygon-news` | `PAUSED — not fetched…`                   | Intentionally disabled for latency; code kept; flip `fetchEnabled` to re-enable                       |
| `polygon-*`                       | `POLYGON_API_KEY is not set…`             | Soft-skip price enrichment (news already paused)                                                      |
| `polygon-prices`                  | HTTP **429** / rate limit note            | Free tier ~5 REST req/min; remaining enrichments deferred; **watermark held**, next tick larger batch |
| `polygon-prices`                  | HTTP **403** `NOT_AUTHORIZED` / timeframe | Plan cannot read that session window; marked unavailable and skipped                                  |
| `sec-edgar`                       | User-Agent / SEC HTTP errors              | Fix `SEC_EDGAR_USER_AGENT`; required for Must path                                                    |

## Per-vendor watermarks (`vendor_fetch_state`)

Each source id has a row with `last_fetched_at` / `last_status`:

- **Success (`ok`)** → advance `last_fetched_at` to now.
- **Rate limited / error / skipped** → keep the previous watermark.
- **`polygon-news`** uses the watermark as `published_utc.gte` (with a small overlap). After a
  429 or a gap ≥ 3 minutes, the next request uses catch-up limit **100** (vs steady-state **40**)
  so articles are not lost when free-tier quota trips.
- **`polygon-prices`** still drains a null-`historical_impact` queue; after a 429 the next tick
  bumps the enrich batch (up to 6). If news was rate-limited in the same tick, prices are
  deferred so we do not stack another 429 on the shared budget.
- **`sec-edgar`** Atom feeds use per-form watermarks (`sec-edgar:8-K`, `sec-edgar:4`, …) and
  `start=` pagination (up to 5×100) when a page is full of unknown accessions — so Form 4/8-K
  bursts cannot silently roll off `getcurrent`. EOD **daily-index** (`master.YYYYMMDD.idx`)
  reconciles via `sec-edgar:daily-index` for multi-hour/day gaps.

See `src/lib/jobs/vendor-fetch-state.ts`, `src/lib/jobs/polygon-news-window.ts`,
`src/lib/jobs/sec-atom-pagination.ts`, and `src/lib/jobs/sec-daily-index.ts`.

## Admin UI

`/admin` lists the numbered Must→Should order, shows phase plan, and prints
ranked results after “Fetch all sources now”.
