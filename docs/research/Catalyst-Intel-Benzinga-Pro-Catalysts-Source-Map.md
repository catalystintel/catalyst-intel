# Catalyst Intel — Benzinga Pro Catalysts → Apply Map

**Role:** Product + ingest decision guide (apply what we can; buy what we must)  
**Date:** 2026-07-22 (updated after product apply)  
**Repo:** `catalyst-intel` · branch flow `feat/*` → `dev` → `main`

---

## Applied vs Suggested (2026-07-22)

### Applied in product (checklist)

Shipped in `feat/benzinga-catalyst-parity`:

- **dev PR:** https://github.com/zhbar10/catalyst-intel/pull/66 (merged)
- **main promote:** https://github.com/zhbar10/catalyst-intel/pull/67 (merged)

- [x] **Finnhub** earnings / FDA / news classified into Benzinga-like panels (`earnings`, `regulatory`, `deals`, `capital`, `analyst`, `macro`, …)
- [x] **Finnhub Analyst Actions (partial)** — `/stock/recommendation` + `/stock/price-target` on earnings-calendar symbols (cap 8) → `eventCategory: analyst` (**Analyst Actions**); free-tier soft-fail per symbol
- [x] **SEC forms** tagged with Benzinga calendar analogs (`bz:sec_filings`, `bz:secondary_offerings`, `bz:ma`, `bz:insiders`); Read view shows **BZ panel** analog
- [x] **Nasdaq halts** unchanged (already Halts-parity)
- [x] **openFDA + ClinicalTrials** unchanged (already FDA calendar path)
- [x] **Polygon news**: Benzinga publisher → labeled **Benzinga Wire** (`type: Wire`, `subcategory: benzinga_wire`) when `POLYGON_API_KEY` is set; other headlines classified
- [x] **WIIM-lite**: `deriveWhyMoving` joins catalyst text + optional Polygon session Δ (`historical_impact`; free-tier soft-fail 429/403)
- [x] **Macro calendar** (keyless): CPI / NFP / FOMC → `eventCategory: macro` (Economics panel analog). FRED live prints = Should later
- [x] Taxonomy: **`macro`** + **`analyst`** categories with day-trader priorities
- [x] Honest docs: no Squawk / UOA / Wire-exclusive claims without a real vendor

### Suggested only (do not fake)

| Gap                      | Closest vendor                                                            | Why not Applied                                        |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------ |
| Wire exclusives / scoops | Benzinga News API (`licensing@benzinga.com`) or Massive **business** deal | DIY ~$99 packs ≠ SaaS redistribute                     |
| Full ratings firehose    | Benzinga Ratings (Massive) · Intrinio · TipRanks                          | Finnhub rec/PT = consensus snapshots, not Street ticks |
| UOA / Signals            | Unusual Whales · Benzinga UOA · OPRA                                      | Paid tape + redistribute rider                         |
| Squawk                   | No public equivalent                                                      | Human desk; TTS ≠ Squawk                               |
| Guidance / call books    | Benzinga Guidance API                                                     | Partial via 8-K + earnings only                        |
| FRED live print values   | FRED API (free)                                                           | Schedule stub shipped; actuals optional later          |

**Not claimed:** Squawk, UOA/Signals, Wire 15‑min beat, full Street ratings firehose.

---

## 1. Decision lanes (Apply-now vs Needs-paid-license vs Later)

### Apply now (free / keyless / existing soft-fail keys)

| Lane                                   | What                                                                                | Status in CI                              |
| -------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------- |
| SEC EDGAR 8-K / 4 / S-3 / 424B / 13D·G | Material filings → Newsfeed + Calendar SEC / M&A / Offerings / Insiders             | **Working**                               |
| Nasdaq Trade Halt RSS                  | Halts / resumes                                                                     | **Working**                               |
| openFDA + ClinicalTrials.gov           | FDA approvals + trial updates                                                       | **Working**                               |
| Macro calendar (embedded BLS + Fed)    | CPI / NFP / FOMC dates                                                              | **Working (new)**                         |
| Finnhub (if `FINNHUB_API_KEY`)         | Earnings + FDA + news + **recommendation trends / price targets** → Analyst Actions | **Working when keyed**                    |
| Polygon news (if `POLYGON_API_KEY`)    | Wire-tagged when publisher is Benzinga; else Market News                            | **Working when keyed**                    |
| Polygon prices (same key)              | Session % move for WIIM-lite / Δ since publish                                      | **Working when keyed (free-tier limits)** |
| Form4API (optional)                    | Insider enrichment                                                                  | Soft-skip without key                     |

### Needs paid / redistribute license (do not treat individual packs as SaaS rights)

| Need                                | Closest vendor                                                               | Cost (order-of-magnitude)             | Latency         | Notes                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| **Wire exclusives / scoops**        | Benzinga News API direct (`licensing@benzinga.com`) or Massive business deal | Enterprise (not $99 DIY)              | Seconds         | Individual Massive Benzinga packs ≈ **personal use**; SaaS redistribute needs a contract |
| **Analyst ratings firehose**        | Benzinga Ratings (Massive) · Intrinio · TipRanks · Tiingo (partial)          | ~$99+/mo DIY → enterprise for product | Minutes         | Finnhub consensus rec/PT **Applied** as partial Analyst Actions; firehose still paid     |
| **Corporate guidance book**         | Benzinga Guidance API                                                        | Paid                                  | Minutes         | Partial substitute: 8-K + earnings PR                                                    |
| **UOA / Signals**                   | Unusual Whales · Benzinga UOA · OPRA vendors (Tradier etc.)                  | Paid, often expensive                 | Seconds–minutes | **Do not claim UOA** until wired + licensed                                              |
| **PR wires (official)**             | PR Newswire / Business Wire / GlobeNewswire APIs                             | Paid                                  | Minutes         | Good redistribute if licensed                                                            |
| **Finnhub commercial redistribute** | Finnhub paid / enterprise                                                    | Paid                                  | Minutes         | Free tier = weak redistribute rights                                                     |

### Later / not cloneable cheaply

| Benzinga asset                | Reality                         | CI stance                                                      |
| ----------------------------- | ------------------------------- | -------------------------------------------------------------- |
| **Squawk**                    | Human audio desk all session    | **Later / never claim** — TTS over own feed ≠ Squawk           |
| **WIIM editorial**            | Human judgment + volume framing | **WIIM-lite Applied**: catalyst one-liner + optional session % |
| **15‑min media beat**         | Desk + exclusives               | Impossible on public EDGAR/PR alone                            |
| **Unified 12–15 calendar UX** | Curated books + history         | Stitch existing sources; buy ratings/UOA packs later           |

---

## 2. Closest Benzinga-equivalent vendors (honest)

| Benzinga panel                       | Closest API / vendor                                                          | Fit                                                              | Cost / license honesty                        | Latency (poll 1–5 min) |
| ------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------- | ---------------------- |
| **Newsfeed / Wire**                  | Polygon/Massive Benzinga news · Benzinga News API                             | High for headlines; exclusives need enterprise                   | DIY packs ≠ redistribute                      | Near-real-time on paid |
| **Calendar — Earnings**              | Finnhub `/calendar/earnings` · Massive Benzinga earnings                      | High scaffolding                                                 | Finnhub freemium; commercial license for SaaS | Minutes–hours          |
| **Calendar — FDA**                   | openFDA + ClinicalTrials + Finnhub FDA                                        | Medium–high structured; lag vs Wire on decisions                 | Free gov + Finnhub                            | Hours–day structured   |
| **Calendar — Economics**             | Embedded macro calendar (CI) · FRED (optional free key) · Finnhub econ (paid) | High for CPI/NFP/FOMC dates                                      | CI path is **keyless**                        | Scheduled exact        |
| **Calendar — Ratings**               | Benzinga Ratings · Intrinio · TipRanks                                        | Medium without Benzinga; Finnhub consensus = **partial Applied** | Paid for firehose                             | Minutes                |
| **Calendar — M&A / Offerings / SEC** | EDGAR 8-K / S-3 / 424B / 13D                                                  | High for _filed_ events; rumors = Wire only                      | Free                                          | Minutes after accept   |
| **Halts**                            | Nasdaq Halt RSS                                                               | High                                                             | Free                                          | ~1 min                 |
| **Insiders**                         | EDGAR Form 4 · Form4API                                                       | High                                                             | Free / freemium                               | Minutes                |
| **Signals / UOA**                    | Unusual Whales · Benzinga UOA · OPRA                                          | High only when paid                                              | Paid + redistribute rider                     | Seconds–minutes        |
| **Squawk**                           | No public equivalent                                                          | None                                                             | N/A                                           | N/A                    |

**Polygon vs Massive:** same news/aggs surface for CI (`POLYGON_API_KEY` / `MASSIVE_API_KEY` alias). Free tier ~**5 REST req/min**; same-day aggs often blocked — prices enrich completed sessions only.

**Intrinio / Tiingo:** useful for fundamentals, calendars, and some news — **not** a Wire desk substitute. Prefer them if Benzinga enterprise is out of budget and you only need structured calendars + delayed news.

**Unusual Whales:** best “buy next” if Signals/UOA becomes a paid CI tier; still no Squawk.

---

## 3. What Catalyst Intel already has working

| Source id        | Contributes                                                               | Benzinga analog                                           |
| ---------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- |
| `sec-edgar`      | 8-K items, Form 4, S-3, 424B, SC 13D·G                                    | SEC / M&A / Offerings / Insiders / Earnings filings       |
| `nasdaq-halts`   | Halt / resume                                                             | Halts                                                     |
| `macro-calendar` | CPI, NFP, FOMC                                                            | Calendar — Economics                                      |
| `finnhub`        | Earnings + FDA + categorized news + recommendation trends / price targets | Earnings / FDA / Newsfeed / **Analyst Actions (partial)** |
| `openfda`        | Drug approval submissions                                                 | Calendar — FDA                                            |
| `clinicaltrials` | Trial updates                                                             | Calendar — FDA / biotech                                  |
| `polygon-news`   | Market news; **Benzinga Wire** when publisher matches                     | Newsfeed (Wire-like when keyed)                           |
| `polygon-prices` | Session impact / Δ                                                        | WIIM-lite building block                                  |
| `form4api`       | Form 4 enrichment                                                         | Insiders                                                  |

Feed filters use shared taxonomy (`earnings`, `regulatory`, `clinical`, `macro`, `analyst`, `trading_halt`, `deals`, `capital`, `insider`, `news`, …). Read view surfaces provider + **BZ panel** analog + WIIM-lite.

---

## 4. Benzinga taxonomy → CI mapping (quick)

| Benzinga panel                   | Catalyst types               | CI source(s)                                   | Lane                                         |
| -------------------------------- | ---------------------------- | ---------------------------------------------- | -------------------------------------------- |
| Newsfeed                         | Filings, PRs, Wire headlines | EDGAR + Finnhub news + Polygon Wire            | Apply / license for exclusives               |
| WIIM                             | Why moving                   | Product: catalyst + Polygon session Δ          | **Applied (lite)**                           |
| Calendar — Earnings              | Dates, BMO/AMC               | Finnhub (+ 8-K 2.02)                           | Apply                                        |
| Calendar — FDA                   | Approvals / trials           | openFDA + ClinicalTrials + Finnhub FDA         | Apply                                        |
| Calendar — Economics             | CPI, NFP, FOMC               | `macro-calendar`                               | Apply                                        |
| Calendar — Ratings               | Up/down/PT                   | Finnhub consensus rec/PT + headline heuristics | **Partial Applied**; firehose **Needs paid** |
| Calendar — M&A / Offerings / SEC | Deals, dilution, filings     | EDGAR                                          | Apply                                        |
| Halts                            | Halt / resume                | Nasdaq                                         | Apply                                        |
| Insiders                         | Form 4                       | EDGAR (+ Form4API)                             | Apply                                        |
| Signals / UOA                    | Unusual options              | —                                              | **Needs paid**                               |
| Squawk                           | Audio                        | —                                              | **Later / never claim**                      |

---

## 5. Buy-next priority (for true Benzinga parity)

1. **Benzinga / Massive enterprise News** — redistributable Wire in Newsfeed (biggest perceived gap).
2. **Benzinga Analyst Ratings** (or Intrinio ratings) — Calendar Ratings completeness.
3. **Unusual Whales or Benzinga UOA** — only if selling a Signals tier.
4. **Finnhub commercial** — if redistributing Finnhub-sourced headlines at scale.
5. **Skip Squawk** until there is budget for a human desk (or explicitly ship “audio of _your_ tape” as a different feature).

**Strategic takeaway:** Compete on **structured primary-source catalysts + clean day-trader UX**. Buy Wire/ratings/UOA only when a paid tier funds the redistribute contract.

---

## 6. Sources consulted

- [Benzinga Pro Newsfeed](https://www.benzinga.com/pro/feature/newsfeed)
- [Benzinga Pro Calendar](https://www.benzinga.com/pro/feature/calendar)
- [Massive/Polygon × Benzinga](https://www.polygon.io/partners/benzinga)
- [Nasdaq Trade Halt RSS](https://www.nasdaqtrader.com/Trader.aspx?id=TradeHaltRSS)
- [SEC Developer Resources](https://www.sec.gov/about/developer-resources)
- [Finnhub pricing](https://finnhub.io/pricing)
- [BLS release schedules](https://www.bls.gov/schedule/) · [FOMC calendars](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm)
- Catalyst Intel `src/lib/jobs/catalyst-sources.ts`
