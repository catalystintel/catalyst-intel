# Nasdaq Halts Source Strategy

**Role:** Engineer decision note (keep / replace / supplement)  
**Date:** 2026-07-25  
**Repo:** `catalyst-intel` · author `zhbar10`  
**Feed:** `https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts`  
**Ingest:** `src/lib/jobs/fetch-nasdaq-halts.ts`

---

## Verdict (one path)

**KEEP `nasdaq-halts` as the primary halt/resume/LULD signal. Do not replace it.**

**SUPPLEMENT with parsing + static enrichment** (reason-code map, structured `rawContent`, synthetic `source_url`, better titles/summaries). Optionally join same-symbol news/filings for “why” context.

**Do not expect this feed to produce Bloomberg/Benzinga-style articles.** It is exchange operations data, not a news wire. Paid halt APIs (e.g. Benzinga HaltResume) package the same subjects with cleaner fields and human labels — buy them only if you already license that vendor for Wire, not to replace Nasdaq RSS for signal coverage.

---

## 1. What the RSS actually has

Sample items (live feed, Jul 2026) look like:

| Field                      | Present?                 | Example / notes                                              |
| -------------------------- | ------------------------ | ------------------------------------------------------------ |
| `<title>`                  | Yes                      | **Symbol only** (`STKH`, `PMI`) — not “Trading Halt”         |
| `<pubDate>`                | Yes                      | Often date-bucketed (midnight-ish), not always exact halt ms |
| `<description>`            | Yes                      | HTML table (CDATA) duplicating structured fields             |
| `<link>` / `<guid>`        | **No on items**          | Channel link is site root; items have no permalink           |
| `ndaq:HaltDate`            | Yes                      | `07/24/2026`                                                 |
| `ndaq:HaltTime`            | Yes                      | `19:50:00.000` (ET)                                          |
| `ndaq:IssueSymbol`         | Yes                      | `STKH`                                                       |
| `ndaq:IssueName`           | Yes                      | Company short name                                           |
| `ndaq:Market`              | Yes                      | `NASDAQ` / `AMEX` / etc.                                     |
| `ndaq:ReasonCode`          | Yes                      | `T1`, `T12`, `H11`, `LUDP`, …                                |
| `ndaq:PauseThresholdPrice` | Often empty              | Populated for LULD-style pauses                              |
| `ndaq:ResumptionDate`      | Often empty until resume |                                                              |
| `ndaq:ResumptionQuoteTime` | Often empty until resume |                                                              |
| `ndaq:ResumptionTradeTime` | Often empty until resume |                                                              |

**Constraints (Nasdaq):** refresh ≤ once per minute (`ttl` ≈ 1). Same data as the Trade Halts page. Covers Nasdaq-listed and other exchange-listed securities surfaced on that page. Query variants: `&haltdate=mmddyyyy`, `&resumedate=mmddyyyy`.

**Reason codes** (official page `Trader.aspx?id=TradeHaltCodes`) include: T1 news pending, T2 news released, T5/T7 single-stock pause, T12 info requested, H4/H9/H10/H11 regulatory, LUDP/LUDS volatility pause, MWC1–3 market-wide CB, plus resume codes (T3, R*, C*, etc.).

---

## 2. What Catalyst Intel stores today

From `fetch-nasdaq-halts.ts` → `ingestNormalizedCatalysts`:

| Stored                          | How                                           | Quality today                                                                                |
| ------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `provider`                      | `"nasdaq-halts"`                              | OK                                                                                           |
| `externalId`                    | `nasdaq-halts:${guid\|\|link\|\|title}`       | Falls back to **title = symbol** → weak uniqueness over time                                 |
| `raw_sources.url` / `sourceUrl` | `item.link`                                   | **Always null** — RSS items have no `<link>`                                                 |
| `title`                         | `` `${symbol} — ${headline}` ``               | Broken: title is symbol-only → headlines like **`STKH — STKH`** (confirmed in Turso samples) |
| `headline` / `subcategory`      | `parseHaltTitle(title)`                       | Expects words like “halt”/“resumed” in title; **never present** → wrong subcategory          |
| `summary`                       | HTML-stripped description                     | Ugly column-header soup, or thin                                                             |
| `rawContent`                    | `{ title, description, pubDate, link, guid }` | **Drops all `ndaq:*` fields**                                                                |
| `eventCategory`                 | `trading_halt`                                | OK                                                                                           |
| `confidence`                    | 80                                            | Fine for ops signal                                                                          |
| Company name                    | Set to symbol                                 | Ignores `ndaq:IssueName`                                                                     |

UI already has hooks that assume structured halt fields (`haltDetailCard` looks for `reasonCode`, `haltTime`, `resumptionTime`, `market` in `rawContent`) — those fields are never written by the fetcher today. Reader falls back to generic synthesis (“was placed under a trading halt on Nasdaq”).

---

## 3. Can this feed match Bloomberg / Benzinga Pro “articles”?

**No — not as an article source.**

| Dimension                                            | Nasdaq Halt RSS                  | Benzinga Pro / Bloomberg halt UX              |
| ---------------------------------------------------- | -------------------------------- | --------------------------------------------- |
| Subject coverage (halt / LULD / resume / regulatory) | Strong (primary exchange notice) | Strong (usually derived from exchange + desk) |
| Latency                                              | ~1 min poll                      | Seconds on paid desk/API                      |
| Structured facts                                     | Excellent if `ndaq:*` parsed     | Excellent + human `halt_type`                 |
| Headline quality                                     | Ops codes / symbol               | “Trading halted — news pending”               |
| Article body / narrative                             | None                             | Desk sentence + related news                  |
| “Why is it moving?”                                  | Not in feed                      | Joined to Wire / filings                      |
| Permalink                                            | None                             | Vendor deep link                              |

**Honest bar:** After enrichment, CI can match **Benzinga Halts panel / calendar HaltResume** for _facts_. It will not match **Wire scoops or Bloomberg story body** without a separate news license + join.

---

## 4. Alternatives covering the same subjects

| Source                                                   | Fit for halt subjects           | Cost / license                            | Notes                                                                                  |
| -------------------------------------------------------- | ------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| **Nasdaq Trade Halt RSS (current)**                      | Best free primary               | Free; ≤1/min                              | Keep as spine                                                                          |
| **Benzinga HaltResume** `GET /api/v1/signal/halt_resume` | Same subjects, cleaner JSON     | Paid (token); redistribute needs contract | Fields: `symbol`, `name`, `exchange`, `halt_type`, `description`, `time`, `importance` |
| **Stock Titan / similar trackers**                       | UX wrappers on UTP/Nasdaq       | Product ToS; not a clean API for SaaS     | Scrape = fragile                                                                       |
| **Finnhub**                                              | **No per-symbol halt endpoint** | —                                         | `/stock/market-status` = exchange open/closed only                                     |
| **Polygon / Massive**                                    | News may _mention_ halts        | Existing key                              | Not a halt ops feed                                                                    |
| **NYSE / other venue pages**                             | Partial overlap                 | Mixed                                     | Nasdaq RSS already includes many non-Nasdaq listings                                   |
| **Direct UTP / SIP market data**                         | True RT                         | Expensive exchange fees                   | Overkill for CI blotter                                                                |

**Replace Nasdaq RSS?** Only if you deliberately standardize on a paid calendar (Benzinga) and accept vendor dependency for a free primary signal. Not recommended.

---

## 5. Scraping / enrichment — practical for Next.js + Turso

### Worth doing (no HTML scrape)

1. **Parse `ndaq:*` in the existing RSS job** (fast-xml-parser already used). Store in `rawContent`:
   - `issueSymbol`, `issueName`, `market`, `reasonCode`, `haltDate`, `haltTime`
   - `pauseThresholdPrice`, `resumptionDate`, `resumptionQuoteTime`, `resumptionTradeTime`
2. **Static reason-code map** (copy from Trade Halt Codes page into `src/lib/catalysts/halt-reason-codes.ts`). Maps `T1` → “News pending”, `LUDP` → “Volatility trading pause (LULD)”, etc. Refresh when Nasdaq updates codes (rare).
3. **Title / headline builder** from structured fields, e.g.  
   `STKH — Trading halt (News pending)` / `PMI — Regulatory halt (H11)` / resume when resumption times or resume codes appear.
4. **Synthetic `source_url`**:  
   `https://www.nasdaqtrader.com/Trader.aspx?id=TradeHalts`  
   (or halt-search URL if you find a stable query). Fixes null Proof links without inventing a fake per-item permalink.
5. **Stable `externalId`**: hash `symbol|haltDate|haltTime|reasonCode` (not title alone).
6. **Subcategory**: map resume codes / non-empty resumption trade time → `halt_resumed`; LUDP/T5 → pause; T1/T2/T12/H* → `halt`.
7. **Summary synthesis**: 2–3 sentences from symbol + company + reason label + times (UI already half-ready).

### Optional scrape (low priority)

| Target                                           | Value                                                           | Cost / risk                                    |
| ------------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------- |
| Trade Halt Codes page                            | Only if you refuse to hardcode the map                          | Easy HTML table; scrape monthly in a chore job |
| Current Trade Halts HTML                         | **Low** — same fields as RSS; page is not a better article body | Fragile ASP.NET UI                             |
| Company IR / PR after T1                         | High for “why”                                                  | Needs news join, not halt scrape               |
| SEC EDGAR / Polygon news same symbol ± N minutes | Best free “article body” pairing                                | Already in stack; product join, not RSS scrape |

### Do not bother

- Scraping Stock Titan / Benzinga HTML for halt tables (ToS + breakage).
- Expecting an HTML article body behind each halt (there isn’t one).
- Polling faster than 1/min (violates Nasdaq guideline).

### Schema / stack notes

- No migration required if enrichment stays in `rawContent` JSON + better `title`/`summary`/`url` columns already on `catalysts` / `raw_sources`.
- Cron already pulls `nasdaq-halts` in phase A (`FETCH-ORDER.md`); keep cadence ≥ 60s.
- Turso: store reason label string; don’t need a new table unless you want halt/resume pairing history later.

---

## 6. Gaps vs Benzinga halt / news wire quality

| Gap                                  | Severity    | Fix path                                                    |
| ------------------------------------ | ----------- | ----------------------------------------------------------- |
| Titles = `SYMBOL — SYMBOL`           | **P0**      | Parse `ndaq:*` + reason map                                 |
| `source_url` null                    | **P0**      | Synthetic TradeHalts URL                                    |
| `ndaq:*` ignored; UI halt card empty | **P0**      | Persist structured raw                                      |
| No human reason text                 | P1          | Static code → label map                                     |
| No related news body                 | P2          | Join EDGAR / Polygon / Finnhub news on symbol               |
| ~1 min latency vs BZ RT              | P2          | Accept for free; paid only if product needs seconds         |
| No Wire exclusives / scoops          | Product gap | Separate Benzinga News license — **not** a halt-API problem |

---

## 7. Recommended implementation order

1. **Fix fetcher** (keep source): parse `ndaq:*`, reason map, titles, `url`, `externalId`, subcategory.
2. **Wire UI**: ensure `haltDetailCard` + article summary consume new `rawContent`.
3. **Product join** (supplement): “Related catalysts” for same symbol in a time window after T1/T2.
4. **Buy Benzinga HaltResume** only if already buying Benzinga calendar/Wire — never as a sole replacement for Nasdaq RSS.

---

## Sources

- Live RSS: `https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts`
- Docs: [Trade Halt RSS](https://www.nasdaqtrader.com/Trader.aspx?id=TradeHaltRSS), [Trade Halt Codes](https://www.nasdaqtrader.com/trader.aspx?id=tradehaltcodes)
- CI: `src/lib/jobs/fetch-nasdaq-halts.ts`, `src/lib/catalysts/article-detail.ts` (`haltDetailCard`), `src/lib/catalysts/article-content.ts`
- Turso samples (prior probe): `source_url: null`, titles like `XQTM — XQTM`
- Benzinga: `GET https://api.benzinga.com/api/v1/signal/halt_resume`
  )
