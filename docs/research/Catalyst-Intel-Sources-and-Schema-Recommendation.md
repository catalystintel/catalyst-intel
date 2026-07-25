# Catalyst Intel — Sources Stack & Schema Recommendation

**Date:** 2026-07-20  
**Repo ground truth:** `catalyst-intel` currently ingests **SEC EDGAR 8-K** (Atom `getcurrent`) into `raw_sources` → `catalysts` / `companies`, and uses **Finnhub** only for **NYSE symbol universe + optional quotes** (`nyse_listings`).  
**Scope:** Research + recommendations only (no implementation).

---

## 1. Executive stack (what to buy / build)

| Priority                   | Source                                                                                | Role                                                                 | Cost reality                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Must (core)**            | **SEC EDGAR** (8-K + expand forms)                                                    | Primary structured corporate catalysts                               | Free; fair-use ≤10 req/s; UA required                                        |
| **Must (calendar)**        | **Finnhub** (earnings, FDA calendar, company news, insider)                           | Calendars + broad news on existing key                               | Free = personal use, 60/min; commercial redistribution needs paid/enterprise |
| **Must (day-trader tape)** | **Nasdaq Trader Halt RSS**                                                            | Halt/resume (news-pending, LULD, etc.)                               | Free; poll ≤1/min                                                            |
| **Should (wire speed)**    | **Benzinga via Polygon/Massive** (or Benzinga direct)                                 | Symbol-tagged editorial wire: analyst, M&A rumors, earnings reaction | Paid / enterprise quote; closest thing to “real-time catalyst news”          |
| **Should (market data)**   | **Polygon.io / Massive**                                                              | Quotes + (optional) news WS for impact scoring                       | Free tier thin; Starter ~$99/mo for useful access                            |
| **Should (biotech)**       | **openFDA** + **ClinicalTrials.gov v2** + Finnhub FDA calendar                        | Approvals, labels, trials, AdCom                                     | Free government APIs                                                         |
| **Should (insider)**       | **SEC Form 4** (own parse) **or Form4API**                                            | Insider buys/sells                                                   | Free EDGAR parse (work) / Form4API free 15k req/mo                           |
| **Later**                  | FRED, EIA, CourtListener, CISA KEV, CoinGecko/CryptoCompare, QuiverQuant, ESG vendors | Macro / energy / legal / cyber / crypto / alt / ESG                  | Mix of free gov + niche paid                                                 |

**Honest constraint:** There is **no free, redistributable, sub-second, full-taxonomy wire**. Free sources are excellent for **filings, calendars, and structured gov data**; **editorial real-time news** (Benzinga-class) is paid. Finnhub free is strong for prototyping but **license = personal use** — productize carefully.

---

## 2. What exists in the repo today

### Ingested

- **SEC EDGAR 8-K** Atom feed → `raw_sources.provider = "sec-edgar"`, `externalId = sec-edgar:{accession}`.
- Maps Item codes → `eventCategory` (`earnings`, `deals`, `management`, `capital`, `distress`, `restructuring`, `governance`, `disclosure`, `other`).
- Rule-based `impactScore` from category priority (AI summary/scoring stubbed; UI says historical impact “coming soon”).

### Adjacent (not catalyst events yet)

- **Finnhub** → `nyse_listings` (XNYS symbols + optional last price). Key already in stack for calendars/news expansion.

### Schema tables (relevant)

- `companies` — name, symbol, sector, marketCap
- `raw_sources` — provider, externalId (unique), url, rawContent JSON, fetchedAt
- `catalysts` — companyId, symbol, companyName, type, title, headline, eventCategory, itemCodes JSON, timestamp, rawSourceId, summary, impactScore

### User-facing fields vs DB (gap preview)

| User field        | Existing?     | Notes                                                                 |
| ----------------- | ------------- | --------------------------------------------------------------------- |
| Category          | Partial       | `eventCategory` — 8-K taxonomy only; too narrow for FDA/Macro/Crypto… |
| Subcategory       | Partial       | `headline` / `itemCodes` / `type` — no first-class subcategory        |
| Company           | Yes           | `companyName` + `companies.name`                                      |
| Symbol            | Yes           | `symbol` (+ `companies.symbol`)                                       |
| Timestamp         | Yes           | `timestamp`                                                           |
| Source            | Partial       | via `rawSourceId` → `provider` / `url` (joined in feed)               |
| AI Summary        | Column exists | `summary` nullable; not filled yet                                    |
| Impact Score      | Yes           | `impactScore` rule-based                                              |
| Confidence        | **Missing**   | —                                                                     |
| Historical Impact | **Missing**   | UI placeholder only                                                   |
| Sector            | Partial       | `companies.sector` (often null today)                                 |
| Tags              | **Missing**   | —                                                                     |

---

## 3. Source research (practical)

Latency bands used below: **RT** = seconds–low minutes; **Near-RT** = minutes–tens of minutes; **Batch** = hours–days.

### 3.1 Corporate filings & capital events

| Source                                          | Categories served                                                                                       | Free / paid                     | Latency                                                         | Reliability     | ToS / notes                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------- | --------------- | ------------------------------------------------ |
| **SEC EDGAR** Atom + `data.sec.gov` submissions | Earnings (2.02), M&A, capital, mgmt, legal/disclosure, product (via 8.01/exhibits), partnerships (1.01) | Free                            | Near-RT after accept                                            | High (official) | ≤10 rps; proper User-Agent; no unclassified bots |
| **SEC Form 4 / 13D/G / SC TO**                  | Insider, activist, tender                                                                               | Free (parse)                    | Near-RT (Form 4 ≤2 business days legally; often faster on feed) | High            | Same EDGAR rules                                 |
| **Form4API**                                    | Insider + enrichment                                                                                    | Free tier 15k/mo; paid          | ~1 min after EDGAR                                              | Good indie      | Easier than DIY parse                            |
| **Finnhub** `stock/insider-transactions`        | Insider                                                                                                 | Free personal / paid commercial | Near-RT                                                         | Good            | Redistribution license issue for SaaS            |

### 3.2 Earnings & guidance

| Source                                                     | Free / paid   | Latency                          | Notes                         |
| ---------------------------------------------------------- | ------------- | -------------------------------- | ----------------------------- |
| **SEC 8-K Item 2.02**                                      | Free          | Near-RT                          | Already primary in repo       |
| **Finnhub** `calendar/earnings`, surprises, press releases | Free personal | Calendar = batch; news = Near-RT | Best next use of existing key |
| **Benzinga** earnings / guidance                           | Paid          | RT wire                          | Best for reaction headlines   |
| **Polygon/Massive** news                                   | Paid tiers    | RT WS claimed ~25ms vendor       | Often bundles Benzinga        |

### 3.3 FDA / clinical / biotech

| Source                                            | Free / paid                        | Latency                  | Notes                                                       |
| ------------------------------------------------- | ---------------------------------- | ------------------------ | ----------------------------------------------------------- |
| **Finnhub** `fda-advisory-committee-calendar`     | Free personal                      | Calendar (not vote RT)   | AdCom dates                                                 |
| **openFDA** (drugs, devices, labels, enforcement) | Free key; 240/min, 120k/day w/ key | Near-RT–Batch            | Great for approvals/recalls/labels; not a “trading wire”    |
| **ClinicalTrials.gov API v2**                     | Free, no key; ~2 rps fair use      | Batch (registry updates) | Phase changes, results posted — **not** same-day PDUFA buzz |
| **Benzinga / Fierce / specialist biotech wires**  | Paid                               | RT editorial             | Needed for “FDA rumor / vote reaction”                      |

**Cannot be free + real-time:** AdCom vote chatter, “PDUFA tomorrow” desk notes, leaked CRL speculation.

### 3.4 News wire / sentiment / analyst

| Source                                           | Free / paid                         | Latency          | Fit                                               |
| ------------------------------------------------ | ----------------------------------- | ---------------- | ------------------------------------------------- |
| **Finnhub** company/general news, news sentiment | Free personal                       | Near-RT          | Broad coverage; weaker trader tagging             |
| **Benzinga** (direct or via Massive)             | Paid                                | RT               | Analyst upgrades, M&A, “why halted”               |
| **Polygon News API**                             | Paid for meaningful use             | RT               | Secondary if already on Polygon for quotes        |
| **Alpha Vantage** `NEWS_SENTIMENT`               | Free ~25 req/day; paid higher       | Near-RT          | Research/sentiment, not day-trader primary        |
| **NewsAPI.org**                                  | Free delayed/dev; Business ~$449/mo | Not trader-grade | No reliable symbol taxonomy — **skip as primary** |

### 3.5 Exchange / ops / halts

| Source                                | Free / paid | Latency        | Notes                                        |
| ------------------------------------- | ----------- | -------------- | -------------------------------------------- |
| **Nasdaq Trader Halt RSS**            | Free        | ~1 min refresh | Must for day traders                         |
| **Benzinga halt/resume calendar API** | Paid        | RT             | Cleaner structured fields                    |
| **NYSE / other exchange notices**     | Mixed       | Varies         | Secondary; Nasdaq RSS covers most US halt UX |

### 3.6 Macro / geopolitical / energy

| Source                        | Free / paid           | Latency                  | Notes                                                                                      |
| ----------------------------- | --------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| **FRED API**                  | Free key              | Batch (release schedule) | CPI, rates, employment — **event timestamps**, not continuous news                         |
| **Finnhub** economic calendar | Free personal         | Calendar                 | Good complement                                                                            |
| **EIA Open Data API**         | Free key              | Batch / scheduled        | Oil inventories, power — Energy category                                                   |
| **Geopolitical**              | No single free RT API | —                        | Use paid wires + curated RSS (State/DoD/central banks) + NLP tagging; expect minutes–hours |

### 3.7 Crypto / cyber / AI / ESG

| Domain         | Practical source                                                           | Reality                                              |
| -------------- | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Crypto**     | CoinGecko / CryptoCompare (market); Finnhub crypto news; paid crypto desks | Price RT free-ish; **catalyst news** still editorial |
| **Cyber**      | CISA KEV JSON (free); company 8-K; paid breach wires                       | KEV ≠ symbol-mapped; need entity resolution          |
| **AI product** | Press releases (8-K 7.01/8.01), Finnhub/Benzinga news + classifier         | No dedicated free “AI catalyst” API                  |
| **ESG**        | LSEG / MSCI / Arabesque-class                                              | **Almost never free**; treat as Later / partner data |

### 3.8 Legal / regulatory (non-FDA)

| Source                                        | Notes                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| **SEC** (Wells, enforcement via filings/news) | Partial via EDGAR + news                                                        |
| **CourtListener / RECAP**                     | Free/cheap dockets; **not** real-time trading wire; good for event-driven legal |
| **DOJ / FTC press RSS**                       | Free Near-RT for antitrust/M&A regulatory                                       |

---

## 4. Taxonomy → source capability map

User taxonomy is **wider** than current `EventCategoryKey`. Recommendation: keep a **stable Category** enum for product, map **Subcategory** freely, and bind ingest via `provider` + `source_event_type`.

| Category family          | Example subcategories                     | Primary source                                  | Secondary                     | Coverage note                     |
| ------------------------ | ----------------------------------------- | ----------------------------------------------- | ----------------------------- | --------------------------------- |
| **FDA / Clinical**       | PDUFA, AdCom, approval, CRL, trial result | openFDA + ClinicalTrials + Finnhub FDA calendar | Benzinga biotech              | Calendar free; vote reaction paid |
| **Earnings**             | Results, guidance, surprise               | SEC 8-K 2.02                                    | Finnhub calendar + Benzinga   | Already strong                    |
| **M&A**                  | Announce, terminate, close                | SEC 8-K 1.01/2.01/5.01                          | Benzinga M&A                  | Rumors need wire                  |
| **Capital Markets**      | Offerings, debt, ATM, buyback             | SEC 8-K 2.03/3.02 + S-3/424B                    | Finnhub IPO calendar          | Expand form types                 |
| **Management**           | CEO/CFO change, board                     | SEC 8-K 5.02                                    | News wire                     | Strong via EDGAR                  |
| **Product**              | Launch, recall, pipeline                  | 8-K 8.01/7.01 + openFDA recall                  | Company news                  | Classifier needed                 |
| **Partnerships**         | Collab, licensing                         | 8-K 1.01                                        | Press/news                    | Often “deals” today               |
| **Legal**                | Lawsuit, settlement, DOJ                  | CourtListener + news + 8-K                      | Benzinga                      | Sparse free RT                    |
| **Regulatory** (non-FDA) | FTC, FCC, EU DMA, sanctions               | Agency RSS + news                               | Paid wire                     | NLP + watchlists                  |
| **Analyst**              | Upgrade/downgrade, PT                     | **Benzinga** (Must for quality)                 | Finnhub recommendation trends | Free APIs weak                    |
| **Exchange**             | Halt, LULD, listing                       | Nasdaq Halt RSS                                 | Benzinga halt API             | Easy win                          |
| **Insider**              | Form 4 cluster buys                       | Form 4 / Form4API / Finnhub                     | QuiverQuant                   | Strong free path                  |
| **Macro**                | FOMC, CPI, NFP                            | FRED + Finnhub econ calendar                    | News reaction wire            | Calendar ≠ tape reaction          |
| **Geopolitical**         | War, sanctions, election                  | Paid wires + curated RSS                        | —                             | Expect imperfect                  |
| **Energy**               | Inventory, OPEC, outages                  | EIA + news                                      | Futures via Polygon later     |                                   |
| **Crypto**               | ETF flows, exchange hack, regulation      | Crypto news APIs + SEC for issuers              | CoinGecko prices              | Dual asset class                  |
| **Cyber**                | Breach, ransomware                        | CISA KEV + 8-K + news                           | —                             | Map vendor→symbol hard            |
| **AI**                   | Model launch, chip export                 | News classifier + 8-K                           | —                             | Tag, don’t new API                |
| **ESG**                  | Rating change, divest                     | Paid ESG vendors                                | News                          | Later                             |
| **Ops**                  | Guidance cut, plant, supply               | 8-K + earnings calls                            | News                          |                                   |
| **Sector-specific**      | Bank stress, biotech AdCom, REIT          | Overlays on above                               | —                             | Filters, not new feeds            |
| **Market Sentiment**     | Social/news sentiment                     | Finnhub / Alpha Vantage sentiment               | Reddit/X paid firehoses       | Noisy; Later for core product     |

**Principle:** One API can cover many subcategories. Prefer **few high-quality ingest jobs** + **classification** over one vendor per subcategory.

---

## 5. Persona prioritization (Must / Should / Later)

Personas: **Day trader** → **Event-driven** → **Swing** → **Analyst**.

### Must (ship for day trader + event-driven)

1. **SEC EDGAR 8-K** (deepen: more reliable item parse, CIK→symbol, AH/PM session tags) — _exists_
2. **Expand EDGAR forms:** Form 4, 6-K (ADRs), selected S-3/424B (dilution), 13D/G
3. **Finnhub earnings calendar** + company news (watchlist-scoped to respect rate limits)
4. **Nasdaq Trader Halt RSS**
5. **Finnhub FDA AdCom calendar** (biotech event-driven)

### Should (swing + serious desk)

6. **Benzinga structured news / analyst / M&A** (via Massive or direct) — primary paid wire
7. **Polygon/Massive** quotes for **post-event move** (feeds Historical Impact)
8. **openFDA** drug/device events + **ClinicalTrials.gov** status changes
9. **Insider** via Form4API or first-party Form 4 parse
10. **FRED + Finnhub economic calendar** (macro session risk)

### Later (analyst breadth / niche)

11. CourtListener / DOJ-FTC RSS (Legal)
12. EIA (Energy)
13. CISA KEV + breach NLP (Cyber)
14. Crypto news + issuer SEC overlap
15. QuiverQuant (Congress)
16. ESG vendor
17. Social sentiment firehoses
18. Geopolitical specialist feeds

---

## 6. Schema recommendation

### 6.1 Verdict

**Keep the three-table spine** (`raw_sources` → `catalysts` ← `companies`). It already matches audit/dedupe needs.  
**Extend `catalysts` (and widen category enums)** rather than inventing a parallel “news” table.  
User’s field list is directionally right; **Confidence, Tags, Subcategory, Historical Impact** are the main gaps. **Source** should stay normalized through `raw_sources`.

### 6.2 Proposed catalyst row (align + extend)

| Field                | Recommend                                        | Storage               | Status vs today                      |
| -------------------- | ------------------------------------------------ | --------------------- | ------------------------------------ |
| `category`           | Rename/alias of `eventCategory`; **expand enum** | `event_category` text | Exists; **widen values**             |
| `subcategory`        | New first-class field                            | `subcategory` text    | Gap (today: headline/items)          |
| `company` / `symbol` | Keep denormalized + FK                           | existing              | OK                                   |
| `timestamp`          | Event time (exchange TZ metadata separate)       | existing              | Add `timezone` or store UTC ISO only |
| `source`             | Join `raw_sources.provider` + `url`              | existing pattern      | OK; expose in API always             |
| `ai_summary`         | Keep as `summary`                                | existing              | Wire AI phase                        |
| `impact_score`       | Keep 0–100                                       | existing              | Evolve beyond category prior         |
| `confidence`         | **Add** 0–1 or 0–100                             | new column            | Gap                                  |
| `historical_impact`  | **Add** JSON or side table                       | new                   | Gap (needs price API)                |
| `sector`             | Prefer `companies.sector`; denormalize optional  | existing              | Backfill from Finnhub profile        |
| `tags`               | **Add** JSON string array                        | new                   | Gap                                  |

### 6.3 Recommended expanded `event_category` (product taxonomy)

Map user families onto a finite enum (playbook-compatible):

`earnings` · `mna` · `capital` · `management` · `product` · `partnership` · `legal` · `regulatory` · `fda` · `analyst` · `exchange` · `insider` · `macro` · `geopolitical` · `energy` · `crypto` · `cyber` · `ai` · `esg` · `ops` · `sentiment` · `distress` · `restructuring` · `governance` · `disclosure` · `other`

- Keep legacy 8-K keys for continuity (`deals` → migrate to `mna` carefully, or accept `deals` as alias).
- **Subcategory** examples: `fda.pdufa`, `fda.adcom_vote`, `analyst.upgrade`, `exchange.halt_news_pending`, `insider.form4_purchase`.

### 6.4 Additional columns / tables worth adding (when implementing)

```
catalysts
  subcategory          text
  confidence           integer        -- 0–100
  tags                 json           -- string[]
  session              text           -- RTH | AH | PM | closed
  provider_event_type  text           -- vendor-native type
  historical_impact    json           -- { "1d": 4.2, "5d": -1.1, "basis": "close" } nullable

-- optional side table if historical series grows
catalyst_outcomes (
  catalyst_id, horizon, return_pct, measured_at, price_provider
)
```

`raw_sources` already perfect for multi-provider ingest — keep `provider` values like: `sec-edgar`, `finnhub-news`, `finnhub-calendar`, `nasdaq-halt`, `openfda`, `clinicaltrials`, `benzinga`, `polygon`, `fred`, `form4api`.

### 6.5 Confidence heuristics (no AI required initially)

| Source class                        | Suggested confidence    |
| ----------------------------------- | ----------------------- |
| SEC primary filing                  | 90–98                   |
| Exchange halt RSS                   | 95                      |
| Finnhub/Benzinga symbol-tagged news | 70–85                   |
| openFDA / ClinicalTrials structured | 80–90 (entity map risk) |
| NLP-classified general news         | 40–65                   |
| Social sentiment                    | 20–40                   |

---

## 7. Phased import order (concrete)

### Phase 0 — Harden what you have (days)

- Keep **SEC 8-K** as golden path; improve CIK/symbol/sector fill via Finnhub company profile.
- Document Finnhub **personal-use** limit; plan commercial license before public SaaS.

### Phase 1 — Must calendars & tape (1–2 weeks)

1. Finnhub **earnings calendar** → catalysts (`category=earnings`, subcategory=`calendar` / `reported`)
2. Finnhub **FDA calendar** → `fda` / `adcom`
3. **Nasdaq Halt RSS** → `exchange` / `halt_*`
4. Finnhub **company news** for watchlist symbols only (rate-limit safe)

### Phase 2 — Must filings breadth (2–4 weeks)

5. EDGAR **Form 4** (DIY or Form4API) → `insider`
6. EDGAR **S-3 / 424B** (dilution) → `capital`
7. Optional **13D/G** → `mna` / activist subcategory

### Phase 3 — Should paid wire + outcomes (when budget)

8. **Benzinga** (analyst, M&A, earnings reaction)
9. **Polygon/Massive** prices → populate `historical_impact` / `catalyst_outcomes`
10. **openFDA** + **ClinicalTrials.gov** delta poll

### Phase 4 — Later breadth

11. FRED + econ calendar reactions
12. EIA, CourtListener, CISA KEV, crypto news, ESG

---

## 8. What cannot be free / truly real-time

| Need                                                | Reality                                                 |
| --------------------------------------------------- | ------------------------------------------------------- |
| Sub-second full news wire with analyst + M&A rumors | **Paid** (Benzinga-class)                               |
| Commercial redistribution of Finnhub data           | **Paid / enterprise license**                           |
| Same-day FDA “desk” chatter / vote leaks            | **Paid editorial**, not openFDA                         |
| Clean ESG ratings as catalysts                      | **Paid** vendors                                        |
| Perfect geopolitical → symbol mapping               | **Never fully automated**; human/AI assist              |
| Free NewsAPI-style aggregators                      | Delayed and weak symbol tagging — unsuitable as primary |

---

## 9. Top recommended sources stack (short list)

1. **SEC EDGAR** — foundation (expand beyond 8-K)
2. **Finnhub** — calendars, news, FDA calendar, profiles (license upgrade for product)
3. **Nasdaq Trader Halt RSS** — day-trader Must
4. **Benzinga (via Polygon/Massive or direct)** — Should for real-time editorial taxonomy
5. **Polygon/Massive** — price outcomes / Historical Impact
6. **openFDA + ClinicalTrials.gov** — biotech depth
7. **Form 4 path** (EDGAR or Form4API) — insider
8. **FRED** — macro calendar backbone

**Schema verdict:** Align to existing Drizzle model; **widen categories**, add **`subcategory`, `confidence`, `tags`, `historical_impact` (or outcomes table)**; keep **`raw_sources` as the multi-provider spine**. User field list is ~80% already modeled.

**Phased import order:** Harden 8-K → Finnhub calendars + halts + watchlist news → more EDGAR forms / Form 4 → Benzinga + Polygon outcomes → gov specialty (openFDA/CT.gov/FRED) → niche Later feeds.
