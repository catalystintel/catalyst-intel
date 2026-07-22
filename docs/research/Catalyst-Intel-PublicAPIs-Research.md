# Catalyst Intel — Free/Public API Research

**Date:** 2026-07-22  
**Primary catalogs:** [publicapis.dev](https://publicapis.dev), [public-apis/public-apis](https://github.com/public-apis/public-apis) (canonical table with Auth/HTTPS/CORS), mirror [publicapis.io](https://publicapis.io)  
**Goal:** Map free/public APIs onto Catalyst Intel’s catalyst subject families for a multi-source POC, with honest latency and free-tier limits. Prefer primary sources over marketing “real-time.”

---

## 1. How to read this report

| Latency label          | Meaning                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| **Near-RT (minutes)**  | Primary feed updates within minutes of official publication; poll every 1–5 min is useful |
| **Same-day / delayed** | Hours of delay, EOD, or vendor calendars that lag the wire                                |
| **Calendar / batch**   | Scheduled releases, daily dumps, historical series — not event wires                      |
| **Aggregator**         | Third-party scrapes/news APIs; latency and completeness vary; ToS/redistribution risk     |

**POC fit scores:** Strong / Partial / Weak / Gap

**Already in Catalyst Intel stack (do not “add” again):** SEC EDGAR, Nasdaq Halt RSS, openFDA, ClinicalTrials.gov, Finnhub, Polygon (news + prices), FRED (referenced), Form4/EDGAR (incl. form4api path).

**Later-phase stubs already named in code:** CourtListener, EIA, CISA, crypto, ESG.

---

## 2. Current stack vs taxonomy (baseline)

| Source                           | Auth                                  | Latency (honest)                                              | Covers today                                                                                                                |
| -------------------------------- | ------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **SEC EDGAR** Atom / submissions | None (User-Agent)                     | Near-RT after EDGAR accepts filing (minutes typical)          | 8-K → earnings, M&A, capital, management, legal, partnerships, ops; Form 4 → insider; 13D/G → ownership; S-3/424B → capital |
| **Nasdaq Trader Halt RSS**       | None                                  | Near-RT exchange notices                                      | Exchange / trading_halt                                                                                                     |
| **openFDA**                      | None (key optional for higher limits) | Batch/same-day; approvals lag press wires                     | FDA & healthcare / regulatory                                                                                               |
| **ClinicalTrials.gov** API       | None                                  | Near-RT on registry updates (not press)                       | Clinical trial status/results updates                                                                                       |
| **Finnhub**                      | API key                               | Free tier: calendars + news samples; **not** a paid news wire | Earnings calendar, FDA calendar (plan-gated), general news sample, listings helpers                                         |
| **Polygon**                      | API key                               | Free/basic: delayed quotes + Benzinga-style news sample       | News / sentiment enrichment, price impact                                                                                   |
| **Form4 / EDGAR Form 4**         | None / vendor key                     | Near-RT via EDGAR; third-party Form4 APIs often delayed/paid  | Insider & ownership                                                                                                         |
| **FRED**                         | API key (free)                        | Macro series; **not** event RT                                | Macroeconomic series for context                                                                                            |

**Implication:** Primary-source filings + FDA/clinical + exchange halts already cover the highest-signal equity catalysts. Gaps are mostly **legal dockets, non-FDA regulation, energy prints, cyber KEV, crypto events, ESG scores, true analyst RT, and paid news wires**.

---

## 3. Subject family → best publicapis.dev / public candidates

| #   | Subject family                           | Best free/public candidates                                                                                                                                         | POC fit                         | Verdict                                                                           |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------- |
| 1   | FDA & Healthcare / Clinical / Regulatory | **openFDA** ([Health](https://publicapis.dev/category/health)), ClinicalTrials.gov (primary; also Clinical Trials Directory on public-apis), CMS.gov (batch), NPPES | Strong (already in stack)       | Covered — deepen openFDA endpoints (drugs+devices+recalls), keep CT.gov           |
| 2   | Earnings                                 | **SEC EDGAR** 8-K Item 2.02; Finnhub earnings calendar; FMP calendar (paid endpoints often locked); Alpha Vantage (delayed)                                         | Strong via EDGAR                | Calendar APIs are **batch**, not beat wires                                       |
| 3   | M&A                                      | **SEC EDGAR** 8-K Item 1.01/2.01 + DEFA14A/SC 13D; news aggregators (MarketAux/Finlight)                                                                            | Strong via EDGAR                | Gap for private/rumored deals without paid M&A databases                          |
| 4   | Capital Markets                          | EDGAR S-3/424B/8-K Item 1.01 financing; Fed Treasury fiscaldata; OpenFIGI (symbology only)                                                                          | Strong via EDGAR                | No free RT “deal desk” wire                                                       |
| 5   | Management / Insider                     | EDGAR Form 4 / 8-K Item 5.02; Aletheia (key); CongressInvests (congressional, key)                                                                                  | Strong via EDGAR                | Third-party insider APIs often paid/normalized wrappers                           |
| 6   | Product & Technology                     | USPTO / PatentsView; arXiv; company 8-K Item 8.01/7.01; news APIs                                                                                                   | Partial                         | Gap for product launches unless disclosed or scraped from news                    |
| 7   | Partnerships & Contracts                 | EDGAR 8-K; USASpending / SAM.gov (gov contracts, batch); FastDOL (enforcement)                                                                                      | Partial                         | Commercial contracts = mostly news/8-K                                            |
| 8   | Legal                                    | **CourtListener / RECAP** (not always on publicapis; primary Free Law Project); Federal Register; FastDOL                                                           | Partial → Strong if stub filled | PACER full RT still paid; RECAP is incomplete but best free federal docket signal |
| 9   | Regulatory (non-FDA)                     | **Federal Register** ([Government](https://publicapis.dev/category/government)); EPA; FEC; OpenSanctions; Data.gov                                                  | Strong for FR                   | Agency-specific RT often needs dedicated feeds                                    |
| 10  | Analyst Actions                          | Finnhub/FMP/AV upgrades (usually **paid** or delayed); news tagged “upgrade/downgrade”                                                                              | **Gap**                         | No credible free RT analyst wire (Benzinga/FactSet/Bloomberg territory)           |
| 11  | Exchange (halts, listings)               | **Nasdaq Halt RSS** (in stack); Finnhub exchange endpoints; NYSE notices (limited free)                                                                             | Strong                          | Covered for US halts; other venues weaker free                                    |
| 12  | Insider & Ownership                      | EDGAR Form 4 + 13F/13D/G; Aletheia; StockFit; Earnings Feed listing                                                                                                 | Strong via EDGAR                | Institutional 13F is **quarterly lag** by design                                  |
| 13  | Macroeconomic                            | **FRED**; Econdb (no auth); Fed Treasury; World Bank; BLS via FRED; EconPulse (key)                                                                                 | Strong for series               | Prints are scheduled; “surprise” needs calendar + release scrape                  |
| 14  | Geopolitical                             | OpenSanctions; Federal Register sanctions; GDELT (now productized/paid cloud); news APIs (Finlight/MarketAux/GNews); RiskSentinel                                   | Partial                         | Free structured geo events thin; news + sanctions lists best free combo           |
| 15  | Energy & Commodities                     | **EIA** Open Data (free key; later stub); Goldprice.dev (no auth); FRED commodities                                                                                 | Strong for EIA                  | Spot commodity RT = often paid; EIA is official but not tick RT                   |
| 16  | Cryptocurrency                           | CoinGecko (no auth / soft limits); CoinCap; CryptoCompare (key); exchange public websockets                                                                         | Strong for prices               | **Catalyst** events (hacks, ETF, delist) need news/CISA/exchange notices          |
| 17  | Cybersecurity                            | **NVD** ([Security](https://publicapis.dev/category/security)); **CISA KEV JSON** (primary feed, no auth); MSRC; GreyNoise (limited free)                           | Strong if stub filled           | Map vendor→ticker is the hard part                                                |
| 18  | AI & Technology                          | arXiv; PatentsView; news APIs; Hugging Face Hub (not classic catalyst)                                                                                              | Partial                         | Product/AI catalysts mostly news + 8-K                                            |
| 19  | ESG                                      | SustainMetrics (GHG factors); EPA; OpenSanctions (governance/PEP); ESG ratings vendors are paid                                                                     | **Gap** for ratings             | Free = emissions factors / EPA / controversies via news, not MSCI-style scores    |
| 20  | Company Operations                       | EDGAR 8-K Item 2.05/2.06/7.01; FastDOL (labor/OSHA); CMS quality (healthcare ops)                                                                                   | Partial                         | Plant closures etc. often 8-K or local news                                       |
| 21  | Sector-Specific                          | openFDA/CT.gov (biotech); EIA (energy); CMS (healthcare); USPTO (tech)                                                                                              | Partial by sector               | No single free “sector catalyst” API                                              |
| 22  | Market Sentiment                         | WallstreetBets API (nbshare); FinSignals (Reddit classify); Styvio; Fear & Greed (alt.me); news sentiment (MarketAux/Finlight)                                      | Partial                         | Social sentiment ≠ institutional; noisy for POC                                   |

---

## 4. Promising APIs — detail cards

Auth / HTTPS / CORS columns cite **public-apis** table values where listed; otherwise verified from vendor docs. CORS rarely matters for server-side ingest (Catalyst Intel pattern).

### 4.1 Primary / government (prefer these)

#### openFDA

- **Catalog:** [publicapis.dev Health — openFDA](https://publicapis.dev/resource/openfda/0004e546-47a5-4e36-b472-94f5be9ad50d)
- **Auth:** None required (API key optional for higher rate limits) | HTTPS Yes | CORS Unknown
- **Subjects:** FDA & Healthcare / Regulatory
- **Latency:** Same-day / batch relative to FDA.gov press; not a Bloomberg-style wire
- **Free:** Yes (rate-limited)
- **POC:** Already integrated — expand device/recall endpoints if needed

#### ClinicalTrials.gov (primary) / Clinical Trials Directory

- **Catalog:** public-apis Health — Clinical Trials Directory wrapper; prefer official CT.gov API v2
- **Auth:** None | HTTPS Yes
- **Subjects:** Clinical
- **Latency:** Near-RT on _registry_ changes; media coverage can lead or lag
- **Free:** Yes
- **POC:** Already integrated

#### SEC EDGAR Data

- **Catalog:** publicapis.dev / public-apis Finance — [SEC EDGAR Data](https://www.sec.gov/edgar/sec-api-documentation)
- **Auth:** None (fair-use User-Agent) | HTTPS Yes | CORS Yes
- **Subjects:** Earnings, M&A, Capital, Management, Insider, Legal disclosures, Partnerships, Ops
- **Latency:** Near-RT (minutes after acceptance)
- **Free:** Yes
- **POC:** Already core — keep as spine

#### Federal Register

- **Catalog:** public-apis Government — Federal Register
- **Auth:** None | HTTPS Yes | CORS Unknown
- **Subjects:** Regulatory (non-FDA), Geopolitical (sanctions rules), ESG-related agency rules
- **Latency:** Same-day publication cycle; documents appear as published (not tick RT)
- **Free:** Yes
- **POC:** **High priority add** — filter agencies (SEC, FDA, Treasury/OFAC, FTC, DOJ, EPA)

#### EPA

- **Catalog:** [publicapis.dev EPA](https://publicapis.dev/resource/epa/oh0ng2kx)
- **Auth:** None | HTTPS Yes | CORS Unknown
- **Subjects:** ESG, Regulatory (environmental), Sector (industrials/energy)
- **Latency:** Batch / dataset-dependent
- **Free:** Yes
- **POC:** Secondary; better as enrichment than live catalyst firehose

#### Fed Treasury (FiscalData)

- **Catalog:** publicapis.dev Finance — Fed Treasury
- **Auth:** None | HTTPS Yes | CORS Unknown
- **Subjects:** Macroeconomic, Capital Markets (gov financing context)
- **Latency:** Calendar / batch
- **Free:** Yes
- **POC:** Context series alongside FRED

#### FRED

- **Catalog:** publicapis.dev Finance — FRED
- **Auth:** API key | HTTPS Yes | CORS Yes
- **Subjects:** Macroeconomic, Energy & Commodities (via series)
- **Latency:** Calendar / batch (release schedules)
- **Free:** Yes
- **POC:** Already referenced — use for release calendars + prints, not “breaking news”

#### OpenSanctions

- **Catalog:** [publicapis.dev OpenSanctions](https://publicapis.dev/resource/opensanctions/997f3acd-36b0-42fd-ac3d-f437aaf6cf09)
- **Auth:** None (rate limits; commercial tiers for heavy use) | HTTPS Yes | CORS Yes
- **Subjects:** Geopolitical, ESG/governance, Regulatory (sanctions)
- **Latency:** Near-RT relative to list updates (hours–days depending on source)
- **Free:** Yes with limits
- **POC:** **Add** for sanctioned entity ↔ ticker/company matching

#### USPTO / PatentsView

- **Catalog:** public-apis Patent — USPTO, PatentsView
- **Auth:** None | HTTPS Yes
- **Subjects:** Product & Technology, AI & Technology, Sector-Specific
- **Latency:** Days–weeks after grant/publication
- **Free:** Yes
- **POC:** Optional enrichment, not core RT catalyst

#### National Vulnerability Database (NVD)

- **Catalog:** public-apis Security — National Vulnerability Database
- **Auth:** None (optional key raises rate limit) | HTTPS Yes | CORS Unknown
- **Subjects:** Cybersecurity
- **Latency:** Hours after CVE publication; not exploit-in-wild confirmation
- **Free:** Yes
- **POC:** Pair with CISA KEV (higher signal)

#### CISA KEV JSON (primary; may be absent from publicapis.dev)

- **URL:** `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`
- **Auth:** None | HTTPS Yes
- **Subjects:** Cybersecurity (highest free signal)
- **Latency:** Near-RT when CISA updates catalog (business hours)
- **Free:** Yes
- **POC:** **Add** — matches later stub `cisa`; map `vendorProject` → public tickers carefully

#### EIA Open Data (primary; later stub)

- **Docs:** https://www.eia.gov/opendata/
- **Auth:** Free API key | HTTPS Yes
- **Subjects:** Energy & Commodities, Macro, Sector-Specific
- **Latency:** Scheduled series / weekly-monthly; some petroleum weekly near-RT for traders but **not** tick data
- **Free:** Yes
- **POC:** **Add** for inventory/price prints as macro-energy catalysts

#### CourtListener / RECAP (primary; later stub)

- **Docs:** https://www.courtlistener.com/api/rest/v4/
- **Auth:** Token / membership for full PACER APIs (2026: broader membership access)
- **Subjects:** Legal, Distress, Company Operations (bankruptcy)
- **Latency:** Near-RT for RECAP contributions; incomplete vs full PACER
- **Free:** Research/membership tiers; not a blank check commercial wire
- **POC:** **Add carefully** — best free federal litigation signal; respect ToS

---

### 4.2 Finance aggregators (skeptical of “real-time”)

#### Finnhub _(in stack)_

- **Catalog:** publicapis.dev Finance — Finnhub
- **Auth:** API key | HTTPS Yes | CORS Unknown
- **Claims:** “Real-Time” REST/WebSocket — **free tier is not a full institutional wire**
- **Honest use:** Earnings/FDA calendars, sparse news, fundamentals helpers
- **POC:** Keep; don’t treat as Reuters replacement

#### Polygon _(in stack)_

- **Catalog:** public-apis Finance — Polygon (“Historical stock market data” — honest labeling)
- **Auth:** API key | HTTPS Yes
- **Honest use:** Delayed prices on free; news sample; paid for RT trades
- **POC:** Keep for impact enrichment

#### Alpha Vantage

- **Catalog:** publicapis.dev Finance
- **Auth:** API key | HTTPS Yes | CORS Unknown
- **Latency:** Free tier heavily rate-limited (≈5 req/min); often delayed/EOD feel
- **Subjects:** Earnings calendar-ish, quotes, FX, crypto
- **Free:** Yes, tight limits
- **POC:** Weak vs Finnhub/EDGAR already present — skip unless needed for a specific series

#### Financial Modeling Prep (FMP)

- **Catalog:** publicapis.dev Finance
- **Auth:** API key | HTTPS Yes
- **Free:** ~250 calls/day; many catalyst endpoints (earnings calendar, etc.) **premium**
- **Latency:** Aggregated; not primary
- **POC:** Optional for analyst estimates / calendar fill if free endpoints suffice

#### Aletheia

- **Catalog:** publicapis.dev Finance — Aletheia
- **Auth:** API key | HTTPS Yes | CORS Yes
- **Subjects:** Insider, earnings call analysis, statements
- **Latency:** Wrapper over public filings — expect delay vs raw EDGAR
- **POC:** Low priority if Form4/EDGAR solid

#### Earnings Feed

- **Catalog:** [publicapis.dev Earnings Feed](https://publicapis.dev/resource/earnings-feed/2c2d85ff-f551-4d14-bd8c-ec28ac5277af)
- **Auth:** (vendor) | Finance category
- **Subjects:** SEC filings, insider, institutional holdings
- **POC:** Overlaps EDGAR — evaluate only if JSON normalization saves engineering time

#### BriefTape

- **Catalog:** public-apis Finance — BriefTape
- **Auth:** API key | HTTPS Yes | CORS Yes
- **Claim:** “Real-time AI-summarized SEC, Fed, FDA, BLS”
- **Honest:** Aggregator + LLM summary; still secondary to primary feeds
- **POC:** Possible UX accelerator, **not** source-of-truth

#### OpenFIGI

- **Catalog:** public-apis Finance
- **Auth:** API key | HTTPS Yes | CORS Yes
- **Subjects:** Symbology only (map instruments)
- **POC:** Enrichment utility, not catalysts

#### Goldprice.dev

- **Catalog:** public-apis Finance
- **Auth:** None | HTTPS Yes
- **Subjects:** Energy & Commodities (PM)
- **Latency:** Spot-ish; verify refresh rate
- **POC:** Lightweight commodity pulse

#### Econdb

- **Catalog:** publicapis.dev Finance
- **Auth:** None | HTTPS Yes | CORS Yes
- **Subjects:** Macroeconomic
- **POC:** Alternate to FRED for international series

#### CongressInvests

- **Catalog:** public-apis Finance
- **Auth:** API key | HTTPS Yes | CORS Yes
- **Subjects:** Insider & Ownership (political), Governance, Sentiment narrative
- **Latency:** Follows PTR disclosures (often delayed by law)
- **POC:** Nice-to-have narrative catalysts; not core equity Form 4

---

### 4.3 News & sentiment (aggregator layer)

#### MarketAux

- **Catalog:** [publicapis.dev News — MarketAux](https://publicapis.dev/resource/marketaux/pfwrr5sd)
- **Auth:** API key | HTTPS Yes | CORS Yes
- **Subjects:** News, Analyst Actions (via headlines), Sentiment, Sector, Geo, AI, ESG controversies
- **Latency:** Near-RT **relative to indexed publishers**; free ~100 req/day
- **Free:** Yes (tight)
- **POC:** **Strong shortlist** for taxonomy fill where primary sources don’t speak

#### Finlight

- **Catalog:** publicapis.dev News
- **Auth:** API key | HTTPS + WebSocket claimed
- **Subjects:** Financial + geo news, sentiment
- **Free:** ~5k req/month (vendor claims)
- **POC:** Competing news layer vs MarketAux/Polygon news — pick one to avoid duplicate headlines

#### GNews / The Guardian / NewsData / Currents

- **Catalog:** publicapis.dev News
- **Auth:** API key | HTTPS Yes
- **Subjects:** Broad news → weak ticker tagging vs MarketAux
- **POC:** Secondary; prefer finance-tagged news APIs

#### WallstreetBets / FinSignals

- **Catalog:** public-apis Finance — WallstreetBets; publicapis.dev FinSignals
- **Auth:** None / key
- **Subjects:** Market Sentiment
- **Latency:** Near-RT social noise
- **POC:** Optional sentiment channel; high false-positive rate

#### RiskSentinel

- **Catalog:** publicapis.dev News
- **Auth:** (vendor)
- **Subjects:** Geopolitical / risk events structured
- **POC:** Evaluate ToS/pricing; marketing may outrun free utility

---

### 4.4 Crypto

#### CoinGecko

- **Catalog:** publicapis.dev Cryptocurrency
- **Auth:** None (Demo) / key for higher | HTTPS Yes | CORS Yes
- **Subjects:** Cryptocurrency prices, market caps, some news/status
- **Latency:** Minutes for prices; not exchange matching engine RT on free
- **POC:** **Add** for crypto price shocks + listing metadata; pair with news for “catalyst”

#### CoinCap / CryptoCompare

- Similar role; CoinCap often no-auth friendly historically
- Prefer one primary crypto price API + news for events

---

### 4.5 Explicit gaps (no good free RT API)

| Need                                | Why free fails                                      |
| ----------------------------------- | --------------------------------------------------- |
| True analyst upgrades/downgrades RT | Sold by FactSet, Bloomberg, Refinitiv, Benzinga Pro |
| Full PACER / state court RT         | PACER fees; state portals fragmented                |
| Rumored M&A / private deals         | Proprietary desks                                   |
| Tick-level US equity RT             | Exchange SIP / paid vendors (Polygon paid, etc.)    |
| Institutional ESG ratings           | MSCI/Sustainalytics paid                            |
| Wire-quality breaking news          | Dow Jones, Bloomberg, Reuters                       |

---

## 5. Comparison matrix — add vs keep

| API                              | vs current stack                         | Recommend for POC?                       |
| -------------------------------- | ---------------------------------------- | ---------------------------------------- |
| Federal Register                 | New regulatory axis beyond FDA           | **Yes**                                  |
| CISA KEV (+ NVD)                 | Fills `cisa` stub                        | **Yes**                                  |
| EIA                              | Fills `eia` stub                         | **Yes**                                  |
| CourtListener                    | Fills `courtlistener` stub               | **Yes** (membership/ToS aware)           |
| OpenSanctions                    | Geo/sanctions not covered                | **Yes**                                  |
| MarketAux or Finlight            | Broader news than Finnhub/Polygon sample | **Yes — pick one**                       |
| CoinGecko                        | Fills `crypto` stub (prices)             | **Yes**                                  |
| Goldprice.dev / FRED commodities | Commodity pulse                          | Optional                                 |
| PatentsView / USPTO              | Tech/product lagging signal              | Optional                                 |
| FMP / Alpha Vantage / Aletheia   | Overlap EDGAR+Finnhub                    | **No** unless specific endpoint needed   |
| BriefTape / Sugra                | Aggregator wrappers                      | Defer                                    |
| SustainMetrics                   | ESG factors only                         | Weak for `esg` stub — pair with news+EPA |

---

## 6. POC shortlist (beyond current stack)

Ordered by signal / engineering ROI:

1. **Federal Register API** — non-FDA regulatory catalysts (SEC/FTC/Treasury/EPA agencies filter).
2. **CISA KEV JSON** (+ optional NVD) — cybersecurity catalysts; implement `cisa` stub.
3. **EIA API v2** — energy inventory/price series events; implement `eia` stub.
4. **CourtListener REST** — litigation/bankruptcy; implement `courtlistener` stub.
5. **OpenSanctions** — sanctions / PEP hits linked to issuers.
6. **One finance news API** — MarketAux _or_ Finlight (not both initially) for Analyst/Partnerships/Geo/ESG _headline_ coverage.
7. **CoinGecko** — crypto market moves + metadata; news still needed for hack/ETF catalysts.
8. **Optional:** Goldprice.dev, PatentsView, CongressInvests, WallstreetBets sentiment.

**Keep as spine (do not replace):** SEC EDGAR + Nasdaq Halts + openFDA + ClinicalTrials.gov.

**Keep as soft-fail enrichment:** Finnhub + Polygon.

---

## 7. Where paid wires are still required for _true_ real-time

| Catalyst type   | Free ceiling                 | Paid still required for                              |
| --------------- | ---------------------------- | ---------------------------------------------------- |
| Earnings beats  | EDGAR 8-K minutes after file | Pre-file whisper, instant street reaction desks      |
| Analyst actions | Headline scraping only       | Certified RT ratings feeds                           |
| M&A rumors      | None reliable                | Deal databases / wires                               |
| Legal           | RECAP incomplete             | Full PACER + state courts + monitoring services      |
| News            | Aggregator polling           | DJ/Bloomberg/Reuters low-latency                     |
| Equity quotes   | Delayed free                 | SIP / paid Polygon / professional                    |
| ESG scores      | Controversies via news       | Rating agencies                                      |
| Insider Form 4  | EDGAR primary is excellent   | Normalized multi-venue paid only if EDGAR ops burden |

---

## 8. Suggested ingest mapping (POC)

```
Primary filings     → EDGAR (existing)
Exchange            → Nasdaq Halt RSS (existing)
FDA/Clinical        → openFDA + CT.gov (existing)
Regulatory other    → Federal Register (+ OpenSanctions)
Legal               → CourtListener
Cyber               → CISA KEV (+ NVD)
Energy              → EIA (+ FRED/Goldprice)
Crypto              → CoinGecko + news API
Broad taxonomy fill → MarketAux/Finlight → classify into subject families
Macro context       → FRED / FiscalData (not alert spam)
```

Classification tip: treat news aggregators as **candidates** that must pass ticker + taxonomy filters; prefer primary-source confirmation when available (e.g., news “FDA approval” → verify openFDA/EDGAR).

---

## 9. Source notes & skepticism checklist

- publicapis.dev pages often omit Auth/CORS on HTML; trust **github.com/public-apis/public-apis** table + vendor docs.
- “Real-time” on finance listings frequently means “not only EOD historical” — still delayed vs exchange.
- openFDA key is optional; catalog sometimes marks `apiKey` — Catalyst Intel correctly uses keyless.
- GDELT Project’s free DOC API era has largely moved to **GDELT Cloud** (keyed/paid) — don’t plan POC on free GDELT.
- CourtListener API access model changed in 2026 (membership unlocks more PACER APIs) — re-read ToS before production.
- Duplicate ingestion risk: Finnhub news + Polygon news + MarketAux will triple-count the same headline.

---

## 10. Catalog link index (quick)

| Category             | URL                                            |
| -------------------- | ---------------------------------------------- |
| Finance              | https://publicapis.dev/category/finance        |
| Health               | https://publicapis.dev/category/health         |
| News                 | https://publicapis.dev/category/news           |
| Government           | https://publicapis.dev/category/government     |
| Cryptocurrency       | https://publicapis.dev/category/cryptocurrency |
| Security             | https://publicapis.dev/category/security       |
| Canonical Auth table | https://github.com/public-apis/public-apis     |

---

_End of research deliverable. No repo changes. Optional PDF not generated (no pandoc/wkhtmltopdf detected in environment)._
