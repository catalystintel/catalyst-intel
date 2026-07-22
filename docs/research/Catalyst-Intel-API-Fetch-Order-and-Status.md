# Catalyst Intel — API Fetch Order and Current Status

**Generated:** 2026-07-22  
**Production:** https://catalyst-intel.vercel.app  
**Samples:** `C:\Users\user\Downloads\catalyst-fetch-samples\` (GHA run 29923668676, ~13:23 UTC)  
**Code docs:** repo `FETCH-ORDER.md` (also copied to Downloads)

---

## 1. What “fetch order” means now

Ingest is no longer an opaque “run everything somehow.” There is a **Must → Should display order** and a **phased runtime**:

### Display order (Admin + API `sources[]` / `fetchOrder`)

| #   | Source                                    | Priority | What data it contributes                                              |
| --- | ----------------------------------------- | -------- | --------------------------------------------------------------------- |
| 1   | **SEC EDGAR** (`sec-edgar`)               | Must     | 8-K, Form 4, S-3, 424B, SC 13D/G filings into the Live tape           |
| 2   | **Nasdaq Halts** (`nasdaq-halts`)         | Must     | Trading halt / resume events                                          |
| 3   | **Finnhub** (`finnhub`)                   | Should   | Earnings calendar, FDA calendar, company news                         |
| 4   | **openFDA** (`openfda`)                   | Must     | Recent FDA drug approval (AP) submissions                             |
| 5   | **ClinicalTrials.gov** (`clinicaltrials`) | Must     | Recent clinical trial study updates                                   |
| 6   | **Polygon news** (`polygon-news`)         | Should   | Market / Benzinga-style news via Polygon/Massive                      |
| 7   | **Polygon prices** (`polygon-prices`)     | Should   | `historical_impact` enrichment from daily aggregates (**after** news) |
| 8   | **Form4API** (`form4api`)                 | Should   | Optional Form 4 enrichment (EDGAR Form 4 still works without it)      |

### Runtime phases (how the orchestrator actually runs)

| Phase | Mode       | Sources                              | Why                                       |
| ----- | ---------- | ------------------------------------ | ----------------------------------------- |
| **A** | Parallel   | SEC, Nasdaq, openFDA, ClinicalTrials | Keyless Must path                         |
| **B** | Parallel   | Finnhub, Form4API                    | Optional API keys (soft-skip if missing)  |
| **C** | Sequential | Polygon news → Polygon prices        | Shared free-tier REST budget (~5 req/min) |

`POST /api/admin/fetch/all` returns `fetchOrder`, `phases`, ordered `sources`, and `totals`. Admin `/admin` shows the numbered list and ranked results.

---

## 2. Status meanings

| Status    | Meaning                                                                |
| --------- | ---------------------------------------------------------------------- |
| `ok`      | Job ran. Check inserted / skipped / errors counts (and any `message`). |
| `skipped` | Soft-skip — usually missing optional key. **Not** a hard outage.       |
| `error`   | Hard failure (HTTP/auth/exception).                                    |

### Known error / message patterns

| Pattern                                   | Source         | Meaning                                                                                         |
| ----------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------- |
| `FORM4_API_KEY is not set…`               | form4api       | Expected; Form 4 still comes from SEC EDGAR                                                     |
| `FINNHUB_API_KEY is not set…`             | finnhub        | Soft-skip calendars/news                                                                        |
| `POLYGON_API_KEY is not set…`             | polygon-*      | Soft-skip news + price enrichment                                                               |
| HTTP **429** / rate-limit note            | polygon-prices | Free tier ~5 REST req/min; remaining enrichments deferred to next cron                          |
| HTTP **403** `NOT_AUTHORIZED` / timeframe | polygon-prices | Plan cannot read that session window; marked unavailable and skipped (after soft-handle deploy) |
| High `errors` with status `ok` (pre-fix)  | polygon-prices | Old behavior counted free-tier 403s as hard errors — fixed by Polygon soft-handle promotion     |

---

## 3. Latest production sample (before this promotion)

From GHA cron → production `/api/admin/fetch/all` (2026-07-22T13:23:39Z):

| #   | Source         | Status  | Fetched | Inserted | Skipped | Errors | Notes                                                       |
| --- | -------------- | ------- | ------- | -------- | ------- | ------ | ----------------------------------------------------------- |
| 1   | sec-edgar      | ok      | 142     | 22       | 120     | 0      | Feeds: 8-K 100, Form 4 40, S-3 12, 424B 40; purged 17 stale |
| 2   | nasdaq-halts   | ok      | 24      | 17       | 7       | 0      | Healthy                                                     |
| 3   | finnhub        | ok      | 105     | 1        | 104     | 0      | Key present; mostly duplicates                              |
| 4   | openfda        | ok      | 25      | 0        | 25      | 0      | All already stored / filtered                               |
| 5   | clinicaltrials | ok      | 25      | 0        | 25      | 0      | All already stored / filtered                               |
| 6   | polygon-news   | ok      | 40      | 9        | 31      | 0      | Key present; news inserting                                 |
| 7   | polygon-prices | ok*     | 20      | 0        | 0       | **20** | *Pre-soft-handle: free-tier failures counted as errors      |
| 8   | form4api       | skipped | 0       | 0        | 0       | 0      | `FORM4_API_KEY` not set (expected)                          |

**Totals:** fetched 381 · inserted 49 · skipped 312 · errors 20 (all from polygon-prices)

### Auth note for local probing

Direct local POST with a pulled `CRON_SECRET` returned 401 (secret mismatch). Successful samples came from GitHub Actions using the repo `CRON_SECRET` that matches Vercel Production. Staging cron was skipped (no `STAGING_APP_URL`).

---

## 4. What shipped in this change set

1. **[PR #50](https://github.com/zhbar10/catalyst-intel/pull/50) → `dev` (merged):** Polygon free-tier soft-handle + Must→Should fetch order / phased orchestrator / Admin + `FETCH-ORDER.md`.
2. **[PR #51](https://github.com/zhbar10/catalyst-intel/pull/51) → `main` (merged):** production promote so Admin/fetch matches the documented order and Polygon prices soft-handle 403/429.

After the Vercel production deploy for `main` finishes, re-run Admin “Fetch all” or GHA cron: expect the Must→Should list, `fetchOrder`/`phases` in JSON, and `polygon-prices` with fewer hard `errors` (429 deferred / 403 marked unavailable).

---

## 5. Quick operator cheat sheet

- **Always need:** `SEC_EDGAR_USER_AGENT`
- **Optional (soft-skip):** `FINNHUB_API_KEY`, `POLYGON_API_KEY` (or `MASSIVE_API_KEY`), `FORM4_API_KEY`
- **Cron:** GHA `fetch-sec-edgar-cron.yml` → `POST /api/admin/fetch/all` with `x-cron-secret`
- **Docs in repo:** `FETCH-ORDER.md`, section in `DEPLOYMENT.md`
