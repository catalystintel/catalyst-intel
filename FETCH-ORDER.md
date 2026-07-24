# Catalyst Intel — API fetch order

Canonical Must → Should order for multi-source ingest
(`POST /api/admin/fetch/all`, Admin “Fetch all”, **cron-job.org** every 1 min in prod).

## Display order (Must → Should)

| #   | Source id        | Label              | Priority | Runtime phase | What it contributes                                                                        |
| --- | ---------------- | ------------------ | -------- | ------------- | ------------------------------------------------------------------------------------------ |
| 1   | `sec-edgar`      | SEC EDGAR          | Must     | A             | 8-K, Form 4 buy·sell, S-3, 424B, SC 13D/G (needs `SEC_EDGAR_USER_AGENT`)                   |
| 2   | `nasdaq-halts`   | Nasdaq Halts       | Must     | A             | Trading halt / resume events (keyless)                                                     |
| 3   | `macro-calendar` | Macro calendar     | Must     | A             | CPI / NFP / FOMC dates (keyless; embedded BLS + Fed schedule)                              |
| 4   | `finnhub`        | Finnhub            | Should   | B             | Earnings + FDA + classified news + recent PT + IPO (`FINNHUB_API_KEY`; soft-skip if unset) |
| 5   | `openfda`        | openFDA            | Must     | A             | Recent FDA drug approval (AP) submissions (keyless)                                        |
| 6   | `clinicaltrials` | ClinicalTrials.gov | Must     | A             | Recent study updates (keyless)                                                             |
| 7   | `polygon-news`   | Polygon news       | Should   | C             | Market / Benzinga Wire-tagged news (`POLYGON_API_KEY` / `MASSIVE_API_KEY`)                 |
| 8   | `polygon-prices` | Polygon prices     | Should   | C             | `historical_impact` from daily aggs (**after** news; same key)                             |
| 9   | `form4api`       | Form4API           | Should   | B             | Intentionally skipped — EDGAR Form 4 (+ buy/sell XML) covers insiders                      |

Source of truth in code: `src/lib/jobs/catalyst-sources.ts`
(`CATALYST_SOURCE_IDS`, `CATALYST_SOURCE_CATALOG`, `FETCH_PHASES`).

## Runtime phases (phased parallel)

Execution is **not** fully sequential. Phases run in order A → B → C:

| Phase | Mode       | Sources                                                          | Why                                       |
| ----- | ---------- | ---------------------------------------------------------------- | ----------------------------------------- |
| **A** | Parallel   | SEC EDGAR, Nasdaq Halts, Macro calendar, openFDA, ClinicalTrials | Keyless Must sources; safe to fan out     |
| **B** | Parallel   | Finnhub, Form4API                                                | Optional keys; soft-skip when unset       |
| **C** | Sequential | Polygon news → Polygon prices                                    | Shared free-tier REST budget (~5 req/min) |

One vendor failure never blocks later sources within a parallel phase
(`Promise.allSettled`). Polygon prices always wait for polygon news.

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

| Source           | Typical issue                             | Meaning                                                                                               |
| ---------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `form4api`       | `FORM4_API_KEY is not set…`               | Expected without optional key; EDGAR Form 4 still ingests                                             |
| `finnhub`        | `FINNHUB_API_KEY is not set…`             | Soft-skip; calendars/news not fetched                                                                 |
| `polygon-*`      | `POLYGON_API_KEY is not set…`             | Soft-skip news + price enrichment                                                                     |
| `polygon-prices` | HTTP **429** / rate limit note            | Free tier ~5 REST req/min; remaining enrichments deferred; **watermark held**, next tick larger batch |
| `polygon-news`   | HTTP **429** / rate limit note            | Soft-handled; **`last_fetched_at` not advanced**; next tick widens `published_utc.gte` + limit 100    |
| `polygon-prices` | HTTP **403** `NOT_AUTHORIZED` / timeframe | Plan cannot read that session window; marked unavailable and skipped                                  |
| `sec-edgar`      | User-Agent / SEC HTTP errors              | Fix `SEC_EDGAR_USER_AGENT`; required for Must path                                                    |

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

See `src/lib/jobs/vendor-fetch-state.ts` and `src/lib/jobs/polygon-news-window.ts`.

## Admin UI

`/admin` lists the numbered Must→Should order, shows phase plan, and prints
ranked results after “Fetch all sources now”.
