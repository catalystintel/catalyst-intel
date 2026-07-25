# Catalyst Intel — Client Summary (Combined)

**Document type:** Condensed founder brief (merged + taxonomy & free-API POC)  
**Date:** July 2026  
**Sources merged:**

1. `Catalyst-Intel-Client-Target-Guideline.md` (research-validated client/needs brief — preferred on beachhead, JTBD, built vs aspirational)
2. `Catalyst-Intel-Client-Architecture-and-Flow.md` (architecture, flow, IA, roadmap — kept where complementary)
3. `Catalyst-Intel-Sources-and-Schema-Recommendation.md` (source stack, free vs paid, schema gaps — aligned for POC APIs)

**Reconcile rule:** Prefer research-validated beachhead — **EDGAR-first**, **Act/Dismiss**, and **honest built vs aspirational** labels. Architecture/flow from the earlier doc is retained as product shape, not as product truth where it conflicts. Full category tree below is the product taxonomy target; current repo enums are narrower (8-K-first) and expand toward this tree.

---

## 1. One-line verdict

Catalyst Intel is the **decision / triage layer for catalyst traders** — primary-source events (SEC EDGAR first), scored and playbook-filtered, so the trader can **Act or Dismiss** in seconds. Not a news firehose, not a Bloomberg clone, not options-flow or technical scanning.

---

## 2. Who the client is

### Beachhead (P0 — build for these)

| Persona                                              | Profile                                                                                                 | Core need                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **A — Catalyst day trader** (“Marcus”)               | Full-time / serious part-time US equities; gaps, AH, first hour; small/mid + liquid large-cap catalysts | Fast EDGAR triage, impact tier, one-screen context, quiet mode after open                      |
| **B — Event-driven / catalyst specialist** (“Priya”) | Filings, FDA/calendar (later), M&A with confirmation, contracts — not pure technicals                   | 8-K item taxonomy (1.01 / 2.02 / 5.02 / 7.01 / 8.01), proof links, filters (float/mcap/sector) |
| **C — Active swing around news** (“Elena”)           | Hours–days; earnings aftermath, FDA dates, material SEC                                                 | High-signal watchlist alerts; less midday noise; lean + “priced in?” caution                   |

_(Maps to earlier Architecture P1/P2 + secondary swing.)_

### Expansion (P1 — design for, don’t overbuild)

| Persona                           | Notes                                                                     |
| --------------------------------- | ------------------------------------------------------------------------- |
| **D — Prop / small desk**         | Shared playbook, auditability, low false positives; seat-first buy motion |
| **E — Educator / community lead** | Teachable taxonomy, shareable “why it mattered”; distribution channel     |
| Solo analyst / archive user       | Reliable ingest, searchable history, API later                            |

### Explicit non-targets

Passive long-term research terminal users · pure options-flow · pure technical scanners · Bloomberg/institutional replacement · crypto-first / everything-news (later stubs only)

**Positioning:** _For traders who trade **events**, not only charts or flow._ Desk blotter language — not “AI SaaS.”

---

## 3. JTBD & pains

**Primary JTBD:** When a filing or market-moving event hits, understand _what it is, why it matters, and whether it fits my playbook_ in seconds — then **Act or Dismiss** with confidence.

| Job           | Outcome                                                        |
| ------------- | -------------------------------------------------------------- |
| Detect        | Material catalysts as they hit primary sources                 |
| Classify      | Event type (category / subcategory / 8-K item when applicable) |
| Score         | Materiality / tradability for _my_ universe (explainable)      |
| Contextualize | Why it matters; lean; history when available                   |
| Decide        | Act vs Dismiss without drowning                                |
| Monitor       | Watchlist / quiet playbook after chaos                         |
| Learn         | Which catalyst types I actually trade well                     |

**Pains the product owns:** firehose noise · headline without why · EDGAR research tax · false AI confidence · wrong-lane tools (scanners/flow that miss disclosure semantics).

**Research guardrails:** Edge half-life often ~2–6h on widely followed 8-Ks (longer on thin names if found fast). AI-on-filings has non-trivial number/miss errors — AI = **triage + explanation**, always under **primary-source proof**. Never “verified AI truth.”

---

## 4. Competitive wedge

| Lane                 | Player         | Gap we own                                           |
| -------------------- | -------------- | ---------------------------------------------------- |
| News speed           | Benzinga Pro   | Still a news product; filing depth not core identity |
| Technical discovery  | Trade Ideas    | Weak on _why_ / disclosure semantics                 |
| Options flow         | Unusual Whales | Not catalyst-filing decision UX                      |
| Source of truth      | Raw EDGAR      | Brutal UX; no triage                                 |
| Niche SEC/FDA alerts | Various        | Thin context or spam UX                              |

**Claim:** Clearer catalyst decisions with source proof and less noise.  
**Don’t claim:** Faster than Benzinga wire; Bloomberg killer; guaranteed edge.

**Wedge sentence:** Start at **primary source → taxonomy → materiality → Act/Dismiss**, then attach price/volume/history — not headlines hoping the trader reverse-engineers the filing.

---

## 5. Built vs aspirational (honest)

### Built / in-product orientation (treat as current truth)

- SEC EDGAR ingest + catalyst normalization (admin/cron; 8-K Atom path)
- Supporting pipeline sources exist with varying quality (openFDA, ClinicalTrials, Nasdaq halts, Finnhub-related — expansion, not beachhead identity)
- Live feed UX: **Source | Sector | Title | Time·date** + detail drawer
- Rule-based impact / materiality (0–100 → High/Med/Low); shared category taxonomy (narrower than full tree below today)
- Watchlist + **quiet playbook** (watchlist + category discipline)
- Alerts as a product surface (depth/channels still maturing)
- Auth / dashboard / profile shell; partial historical enrichment via market-data jobs
- Stack shape: Next.js + Turso/libSQL + Supabase auth; poll feed; admin fetch; self-heal on stale

### Aspirational / roadmap (do not overclaim)

- Full AI narrative + trusted Bullish/Bearish/Neutral lean (must stay source-grounded)
- Predictive “AI knows the move” scoring — prefer explanatory + historical base rates
- Rich similar-events outcome DB (moat candidate)
- Deep personalized alert intelligence; Benzinga-class float/liquidity polish
- Fully polished price + volume + news research desk
- FDA as co-equal beachhead (win EDGAR first)
- Prop multi-seat / SSO / audit exports; squawk/chat (non-goal unless distribution requires)
- Full 22-family taxonomy coverage in the live tape (many families are Later / paid-wire)

**Earlier Architecture doc said watchlists/alerts/AI not yet shipped** — superseded by Guideline honesty: foundations exist; AI trust and full alert intelligence remain the climb.

---

## 6. Architecture & data flow (highlights)

### Current path

```
Cron / GitHub Actions → POST /api/admin/fetch/sec-edgar
  → fetchSecEdgar() → SEC EDGAR Atom → Turso/libSQL
Browser poll → GET /api/catalysts (self-heal if stale)
  → Dashboard feed + detail drawer (Supabase OAuth)
```

### Target logical flow

`Sources (EDGAR first → FDA/CT later → optional PR)`  
→ ingest (fetch · normalize · dedupe · symbol resolve)  
→ catalyst store  
→ scoring (rules now → LLM-assist later) + alert rules  
→ API (feed · detail · watchlists · alerts · admin)  
→ trading-desk UI + push channels

### User triage flow

Sign in → Live Feed → scan columns → filter / watchlist / quiet mode → open detail (proof + score reasons) → **Act** (external broker) or **Dismiss** → optional alert rule from event type.

### Alert flow (target)

New catalyst → evaluate user rules → dedupe / rate-limit → email | webhook | push → deep link to detail.

**Latency honesty:** Target disclosure → visible row &lt; 30–60s post-scheduler; today cadence is poll/cron — show event time; never fake “instant.”

---

## 7. Web app must-haves (daily use)

### Session-critical (P0)

1. Live feed with stable row schema: Source | Sector | Title | Time·date
2. Primary-source proof one click away (EDGAR accession / filing URL)
3. **Act / Dismiss** (remember dismissals)
4. Materiality badge + plain-language reason
5. Category filters (aligned to taxonomy families below; beachhead = SEC/Earnings/M&A/Capital/Mgmt/Halts first)
6. Watchlist sync + highlight
7. Quiet playbook that actually reduces noise
8. Reliable symbol / company identity
9. Latency honesty (event time; no fake realtime)
10. Mobile-usable alert path (desktop primary)

### Decision-quality (P0/P1)

Short grounded summary (3–6 bullets) · Lean with uncertainty flag · Market context strip (price / % / RVol) · Liquidity guards (mcap / price / avg vol) · Pre-market emphasis · Duplicate suppression

### Retention & trust (P1)

Alert prefs (category + min materiality + watchlist-only) · personal Act/Dismiss stats · historical analogs · “Why this score?” · graceful failure states

### IA (key screens)

| Area                      | Job                                 |
| ------------------------- | ----------------------------------- |
| Live Feed `/dashboard`    | Triage blotter                      |
| Detail drawer / `/c/[id]` | Proof & understand                  |
| Watchlists                | Playbook focus                      |
| Alerts                    | Away-from-desk rules                |
| Archive / Search          | Post-hoc research                   |
| Profile                   | Prefs (ET default), disclaimer      |
| Admin                     | Fetch, freshness, errors, retention |

**Nav priority:** Feed → Watchlists → Alerts → Archive → Admin.

### Non-goals

Full charting · broker/OMS · options-flow terminal · macro magazine · community chat as core · AI autotrader · Bloomberg replacement

**UX principles:** Blotter density · provenance first · column grammar · explainable scores · keyboard + alert dual path · desk visual language (charcoal/amber; not purple SaaS) · one job per screen · Source &gt; story &gt; score &gt; suggestion

---

## 8. Success metrics (condensed)

| Layer      | Signals                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Activation | Time-to-first Act/Dismiss &lt; 2 min; watchlist or playbook set; ≥1 source proof open                                        |
| Engagement | DAU/WAU beachhead; quiet-mode usage; healthy dismiss %; higher Act rate on High vs Low                                       |
| Trust      | Source-open on Acts; false-positive / mute rates; AI “show source” clicks if AI ships                                        |
| Pipeline   | Ingest lag p50/p95; accession dedupe 100%; symbol resolve &gt;95% on 8-K                                                     |
| Business   | D7 retention among active traders; WTP mid-band ~$40–$200/mo seat (Benzinga reference); prop seats only after FP rate is low |

**North star:** High-materiality catalysts seen and decided on before secondary headline echo — with proof, not speed-theater.

---

## 9. GTM & messaging

1. Win **EDGAR excellence** first (item correctness, proof, latency honesty).
2. Acquire via catalyst educators / filing-trade communities / prop circles — not generic “AI trading” ads.
3. Onboarding forces playbook: categories + watchlist + quiet mode.
4. FDA/clinical after SEC habit.
5. Prop/educator packaging after retail retention proves signal quality.

**Say:** Primary-source catalysts, triaged for action · Act or dismiss in seconds—with EDGAR proof · Built for playbooks, not doomscrolling.  
**Don’t say:** Guaranteed edge · Bloomberg killer · Benzinga but faster (sole claim) · Verified AI without source UX · Real-time if cron-only without disclosing cadence.

---

## 10. Phased roadmap (merged)

| Phase                    | Focus                                                                                                  | Outcome                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| **0 — POC**              | EDGAR 8-K path, feed columns, auth, admin, retention, self-heal; free-API packs that map into taxonomy | Demo-able desk                     |
| **1 — Trustworthy tape** | Explainable scoring, stronger filters, freshness SLA, scheduler reliability, playbook presets          | Daily trust                        |
| **2 — My desk**          | Watchlists/alerts depth, archive, billing-ready                                                        | Paid beta for beachhead            |
| **3 — Multi-catalyst**   | FDA/clinical on same IA; historical reaction stats; API                                                | Expand without losing SEC identity |
| **4 — Later**            | PR wires (careful dedupe), flow confluence, team/SSO, mobile PWA polish                                | Optional bets                      |

---

## 11. What are stock market catalysts

### Definition (Catalyst Intel terms)

A **catalyst** is a **material, time-stamped event** that can change a security’s expected cash flows, risk, ownership, or tradability — and therefore move price and volume. Catalyst Intel treats catalysts as:

1. **Primary-source first** — filing, agency action, exchange notice, or structured registry update (not a rumor headline alone).
2. **Classified** — into a stable **Category** + **Subcategory** (and 8-K item codes when the source is EDGAR).
3. **Triaged** — materiality / playbook fit scored so the trader can **Act or Dismiss** in seconds.
4. **Provenanced** — every row links back to the source URL / accession.

Secondary headlines, social buzz, and unpaid “wires” may _confirm_ or _contextualize_ a catalyst; they are not the system of record. Rumors without primary confirmation stay low-confidence or out of the beachhead feed.

**Beachhead truth:** Most day-trader edge still starts at **SEC EDGAR** (esp. Form 8-K). The taxonomy below is the **full product language** for filters, alerts, and education — not a promise that every subcategory is live on free APIs today.

**Canonical row fields (target):** Category · Subcategory · Company · Symbol · Timestamp · Source · AI Summary (grounded) · Impact Score · Confidence · Historical Impact · Sector · Tags — aligned with Sources & Schema recommendation.

---

### Full taxonomy (all categories & subcategories)

Each subcategory includes a one-line explanation of what the event means for traders.

#### 1. FDA & Healthcare

Material biotech/pharma/device events across trials, designations, and regulatory outcomes.

**Clinical Trials**

| Subcategory             | Explanation                                                                |
| ----------------------- | -------------------------------------------------------------------------- |
| IND Submission          | Company files Investigational New Drug application to begin human studies. |
| IND Clearance           | FDA clears (or does not object to) the IND so trials may proceed.          |
| Phase 1 Initiation      | First-in-human dosing starts; early safety/PK focus.                       |
| Phase 1 Interim Results | Mid-study Phase 1 readout (often safety/dose).                             |
| Phase 1 Topline Results | Headline Phase 1 outcome released.                                         |
| Phase 2 Initiation      | Efficacy-oriented Phase 2 trial begins.                                    |
| Phase 2 Interim Results | Mid-study Phase 2 efficacy/safety update.                                  |
| Phase 2 Topline Results | Headline Phase 2 outcome released.                                         |
| Phase 3 Initiation      | Pivotal Phase 3 trial begins.                                              |
| Phase 3 Interim Results | Mid-study Phase 3 update (can move names hard).                            |
| Phase 3 Topline Results | Headline pivotal efficacy/safety outcome.                                  |
| Trial Completion        | Study completes last visit / database lock milestone.                      |
| Trial Suspension        | Enrollment or dosing paused (often risk signal).                           |
| Clinical Hold           | FDA orders pause on clinical investigation.                                |
| Trial Termination       | Study stopped early (futility, safety, strategy).                          |

**FDA Designations**

| Subcategory                                 | Explanation                                                        |
| ------------------------------------------- | ------------------------------------------------------------------ |
| Fast Track Designation                      | FDA pathway to expedite development/review for serious conditions. |
| Breakthrough Therapy Designation            | Intensive FDA guidance for drugs with substantial early evidence.  |
| Priority Review                             | Shortened FDA review clock vs standard review.                     |
| Accelerated Approval Eligibility            | Pathway based on surrogate/intermediate endpoints.                 |
| Orphan Drug Designation                     | Incentives for rare-disease therapies.                             |
| Rare Pediatric Disease Designation          | Pediatric rare-disease program (incl. voucher potential).          |
| Qualified Infectious Disease Product (QIDP) | Extra exclusivity incentives for qualifying anti-infectives.       |

**Regulatory (FDA pathway outcomes)**

| Subcategory                    | Explanation                                                       |
| ------------------------------ | ----------------------------------------------------------------- |
| NDA Submission                 | New Drug Application filed with FDA.                              |
| BLA Submission                 | Biologics License Application filed.                              |
| MAA Submission                 | Marketing Authorization Application filed (ex-US, typically EMA). |
| FDA Acceptance                 | Agency accepts filing for substantive review.                     |
| Advisory Committee Meeting     | AdCom hearing/vote on approvability or labeling.                  |
| FDA Approval                   | Marketing approval granted.                                       |
| Complete Response Letter (CRL) | FDA declines approval as filed; remediation required.             |
| Label Expansion                | New indication/population/dosing on label.                        |
| Label Restriction              | Narrower use, warnings, or REMS-like constraints.                 |
| Recall                         | Product pulled from market/supply (class varies).                 |
| Safety Warning                 | Significant safety communication (e.g., Dear HCP).                |
| Black Box Warning              | Strongest FDA labeling warning added/updated.                     |

#### 2. Earnings

Periodic results, surprises, and forward outlook that reset valuation narratives.

| Subcategory             | Explanation                                              |
| ----------------------- | -------------------------------------------------------- |
| Earnings Date Announced | Company sets/confirm reporting date (calendar catalyst). |
| Earnings Beat           | Reported results above consensus (context-dependent).    |
| Earnings Miss           | Reported results below consensus.                        |
| Revenue Beat            | Top-line above expectations.                             |
| Revenue Miss            | Top-line below expectations.                             |
| EPS Beat                | EPS above consensus.                                     |
| EPS Miss                | EPS below consensus.                                     |
| Raised Guidance         | Forward outlook increased.                               |
| Lowered Guidance        | Forward outlook cut (often high-impact).                 |
| Preliminary Earnings    | Soft/early results ahead of full release.                |
| Profit Warning          | Explicit warning that results will disappoint.           |
| Positive Outlook        | Constructive qualitative forward commentary.             |
| Negative Outlook        | Cautious/negative qualitative forward commentary.        |

#### 3. Mergers & Acquisitions

Control transactions, breakups, and deal-path updates.

| Subcategory              | Explanation                                    |
| ------------------------ | ---------------------------------------------- |
| Acquisition Announcement | Buyer announces intent to acquire target.      |
| Merger Announcement      | Merger of equals / combination announced.      |
| Buyout Offer             | Formal offer to acquire shares/company.        |
| Going Private            | Take-private transaction proposed/announced.   |
| Tender Offer             | Public offer to purchase shares directly.      |
| Spin-off                 | Business unit to be separated into new entity. |
| Divestiture              | Sale of a business/asset package.              |
| Strategic Review         | Formal review that may lead to sale/options.   |
| Asset Sale               | Material non-core or segment asset sale.       |
| Acquisition Completed    | Deal closed; ownership transfer done.          |
| Competing Bid            | Rival offer appears (deal arb relevant).       |
| Activist Sale Proposal   | Activist pushes sale/breakup of company.       |

#### 4. Capital Markets

Equity, debt, and shareholder-return events that change float, leverage, or dilution.

**Equity**

| Subcategory        | Explanation                                    |
| ------------------ | ---------------------------------------------- |
| IPO Filed          | Registration statement filed for IPO.          |
| IPO Pricing        | Offer price/size set.                          |
| IPO Debut          | First day of public trading.                   |
| Direct Listing     | Lists without traditional underwritten IPO.    |
| Secondary Offering | Follow-on equity sale (often dilutive).        |
| ATM Offering       | At-the-market equity program activity/setup.   |
| PIPE Financing     | Private investment in public equity.           |
| Rights Offering    | Existing holders offered rights to buy shares. |

**Debt**

| Subcategory       | Explanation                                     |
| ----------------- | ----------------------------------------------- |
| Debt Issuance     | New bonds/loans raised.                         |
| Convertible Notes | Convertible debt issued (dilution optionality). |
| Debt Refinancing  | Existing debt replaced/repriced.                |
| Debt Repayment    | Material debt paydown.                          |

**Shareholder Returns**

| Subcategory         | Explanation                                     |
| ------------------- | ----------------------------------------------- |
| Share Buyback       | Repurchase authorization or activity.           |
| Buyback Expansion   | Larger repurchase authorization.                |
| Dividend Initiation | First dividend policy starts.                   |
| Dividend Increase   | Regular dividend raised.                        |
| Special Dividend    | One-time cash return.                           |
| Stock Split         | Share count increase / price adjust.            |
| Reverse Split       | Share consolidation (often listing/compliance). |

#### 5. Management

Leadership, board, and governance changes that alter strategy credibility.

| Subcategory             | Explanation                                              |
| ----------------------- | -------------------------------------------------------- |
| CEO Appointment         | New chief executive named.                               |
| CEO Resignation         | CEO departs / steps down.                                |
| CFO Appointment         | New finance chief named.                                 |
| CFO Resignation         | CFO departs.                                             |
| Founder Returns         | Founder re-enters operating/leadership role.             |
| Board Appointment       | New director joins board.                                |
| Board Departure         | Director leaves board.                                   |
| Insider Buying          | Open-market or reported purchase by insider (mgmt lens). |
| Insider Selling         | Reported sale by insider (mgmt lens).                    |
| Activist Investor       | Activist discloses campaign/stake thesis.                |
| Executive Compensation  | Material pay package / say-on-pay controversy.           |
| Executive Investigation | Exec under internal/external investigation.              |

#### 6. Product & Technology

Product milestones, IP, and tech releases that change competitive position.

| Subcategory             | Explanation                                  |
| ----------------------- | -------------------------------------------- |
| Product Launch          | New product reaches market.                  |
| Product Approval        | Regulatory/commercial approval of a product. |
| Product Delay           | Launch or milestone slipped.                 |
| Product Recall          | Safety/quality recall of a product.          |
| Patent Granted          | Key patent issued.                           |
| Patent Expiration       | Important exclusivity ends.                  |
| Patent Litigation       | IP suit filed/updated.                       |
| Software Release        | Material software version/platform ship.     |
| AI Product Announcement | AI feature/product unveiled.                 |
| Semiconductor Launch    | Chip/product family introduced.              |
| Hardware Launch         | Device/hardware SKU launched.                |
| Manufacturing Milestone | Capacity/yield/plant milestone hit.          |

#### 7. Partnerships & Contracts

Commercial agreements that change revenue visibility or strategic reach.

| Subcategory             | Explanation                                 |
| ----------------------- | ------------------------------------------- |
| Strategic Partnership   | Broad collaboration with strategic partner. |
| Distribution Agreement  | Channel/distribution rights deal.           |
| Licensing Agreement     | IP/tech licensed in or out.                 |
| Joint Venture           | JV formed for shared operations/assets.     |
| Government Contract     | Public-sector award (often 8-K/press).      |
| Military Contract       | Defense/military award.                     |
| Fortune 500 Customer    | Named mega-customer win.                    |
| Enterprise Contract     | Large B2B customer agreement.               |
| Multi-Year Agreement    | Long-duration commercial commitment.        |
| Supply Agreement        | Critical input supply locked in.            |
| Manufacturing Agreement | Contract manufacturing / CMO deal.          |

#### 8. Legal

Litigation, enforcement, and insolvency path events.

| Subcategory             | Explanation                              |
| ----------------------- | ---------------------------------------- |
| Lawsuit Filed           | Material civil suit initiated.           |
| Settlement              | Case resolved via settlement.            |
| Class Action            | Class complaint filed/certified/updated. |
| Patent Lawsuit          | IP-focused litigation event.             |
| SEC Investigation       | SEC probe disclosed/updated.             |
| DOJ Investigation       | DOJ probe disclosed/updated.             |
| Antitrust Investigation | Competition authority scrutiny.          |
| Court Decision          | Material ruling/verdict/order.           |
| Bankruptcy Filing       | Chapter filing / insolvency start.       |
| Bankruptcy Exit         | Emergence / plan confirmation.           |
| Arbitration             | Material arbitration outcome/start.      |

#### 9. Regulatory (non-FDA)

Non-FDA agency rules, permits, and government constraints.

| Subcategory            | Explanation                                    |
| ---------------------- | ---------------------------------------------- |
| New Regulation         | Rulemaking that affects the issuer’s industry. |
| Regulation Repealed    | Rollback of prior rule burden/benefit.         |
| Environmental Approval | Key environmental permit/clearance.            |
| Mining Permit          | Mining-related authorization.                  |
| FAA Approval           | Aviation authorization/certification.          |
| FCC Approval           | Comms/spectrum/device authorization.           |
| FTC Investigation      | FTC inquiry/enforcement path.                  |
| Import Ban             | Goods restricted from import.                  |
| Export Restriction     | Export controls on products/tech.              |
| Government Sanctions   | Sanctions designation impacting business.      |

#### 10. Analyst Actions

Sell-side opinion and target changes (usually secondary wire, not EDGAR).

| Subcategory                  | Explanation                            |
| ---------------------------- | -------------------------------------- |
| Upgrade                      | Rating raised (e.g., Hold→Buy).        |
| Downgrade                    | Rating cut.                            |
| Initiation of Coverage       | New analyst coverage starts.           |
| Reiteration                  | Rating/target restated without change. |
| Price Target Increase        | PT raised.                             |
| Price Target Decrease        | PT lowered.                            |
| Added to Conviction List     | Named to high-conviction list.         |
| Removed from Conviction List | Dropped from conviction list.          |

#### 11. Exchange

Listing status and trading interruptions.

| Subcategory         | Explanation                        |
| ------------------- | ---------------------------------- |
| Nasdaq Listing      | Lists on Nasdaq.                   |
| NYSE Listing        | Lists on NYSE.                     |
| Uplisting           | Moves to higher exchange/tier.     |
| Delisting Warning   | Deficiency / delisting notice.     |
| Delisting           | Removed from exchange.             |
| Compliance Restored | Cures listing deficiency.          |
| Trading Halt        | Trading paused (news, LULD, etc.). |
| Halt Resumed        | Trading resumes after halt.        |

#### 12. Insider & Ownership

Ownership and control disclosures (Form 4 / 13D/G and related).

| Subcategory              | Explanation                                       |
| ------------------------ | ------------------------------------------------- |
| Insider Purchase         | Form 4 / reported buy by insider.                 |
| Insider Sale             | Form 4 / reported sell by insider.                |
| Institutional Buying     | Large institution increases stake.                |
| Institutional Selling    | Large institution reduces stake.                  |
| 13D Filing               | Active beneficial ownership (&gt;5%) with intent. |
| 13G Filing               | Passive beneficial ownership disclosure.          |
| Major Shareholder Change | Significant ownership shift disclosed.            |
| Hedge Fund Position      | Notable HF stake disclosure/update.               |

#### 13. Macroeconomic

Macro releases and Fed path that reprice risk assets broadly.

| Subcategory            | Explanation                        |
| ---------------------- | ---------------------------------- |
| Federal Reserve        | Fed-related policy event umbrella. |
| Interest Rate Decision | FOMC rate decision.                |
| FOMC Minutes           | Published minutes (policy nuance). |
| Fed Speech             | Material Fed speaker remarks.      |
| Economic Data          | Scheduled macro print (generic).   |
| CPI                    | Consumer inflation print.          |
| Core CPI               | Core inflation print.              |
| PPI                    | Producer prices print.             |
| GDP                    | Growth print.                      |
| Retail Sales           | Consumer spending print.           |
| Non-Farm Payrolls      | Jobs report.                       |
| Initial Jobless Claims | Weekly claims.                     |
| PMI                    | Manufacturing/services PMI.        |
| Consumer Confidence    | Sentiment survey.                  |
| Housing Starts         | Housing activity print.            |
| Existing Home Sales    | Home sales print.                  |

#### 14. Geopolitical

Statecraft and conflict events with market transmission.

| Subcategory      | Explanation                     |
| ---------------- | ------------------------------- |
| War              | Kinetic conflict escalation.    |
| Ceasefire        | Hostilities pause/agreement.    |
| Elections        | Material election outcome/risk. |
| Tariffs          | Tariff imposition/change.       |
| Trade Agreement  | Trade deal announced/advanced.  |
| Sanctions        | Geopolitical sanctions package. |
| Export Controls  | Strategic tech/trade controls.  |
| Political Crisis | Government instability event.   |

#### 15. Energy & Commodities

Supply, discovery, and cartel/policy events in resources.

| Subcategory                 | Explanation                      |
| --------------------------- | -------------------------------- |
| Oil Discovery               | Material oil find.               |
| Gas Discovery               | Material gas find.               |
| Mining Discovery            | Material mineral discovery.      |
| Production Guidance         | Output guidance change.          |
| OPEC Decision               | OPEC+/cartel output decision.    |
| Commodity Supply Disruption | Outage/war/weather supply shock. |
| Renewable Project Approval  | Major renewable project cleared. |

#### 16. Cryptocurrency

Crypto-market structure and issuer/network events (Later for equity beachhead).

| Subcategory      | Explanation                      |
| ---------------- | -------------------------------- |
| ETF Filing       | Crypto ETF registration filed.   |
| ETF Approval     | Crypto ETF approved.             |
| ETF Rejection    | Crypto ETF denied.               |
| Exchange Listing | Token/asset listed on venue.     |
| Delisting        | Token/asset removed from venue.  |
| Network Upgrade  | Protocol upgrade/hard-fork path. |
| Token Burn       | Supply burn event.               |
| Hard Fork        | Chain split / hard fork.         |

#### 17. Cybersecurity

Security incidents and infrastructure failures with disclosure risk.

| Subcategory            | Explanation                                  |
| ---------------------- | -------------------------------------------- |
| Data Breach            | Personal/corporate data compromised.         |
| Ransomware Attack      | Ransomware incident disclosed/impacting ops. |
| Security Vulnerability | Critical vuln affecting products/customers.  |
| Major Outage           | Prolonged service outage.                    |
| Cloud Incident         | Cloud provider/customer cloud failure.       |
| Infrastructure Failure | Critical infra downtime event.               |

#### 18. AI & Technology

AI/compute/cloud scale events that reprice growth narratives.

| Subcategory                  | Explanation                      |
| ---------------------------- | -------------------------------- |
| AI Partnership               | Strategic AI collab announced.   |
| AI Model Release             | New model family released.       |
| AI Infrastructure Investment | Capex/build for AI infra.        |
| GPU Deployment               | Large GPU/cluster deployment.    |
| Data Center Expansion        | DC capacity expansion.           |
| Major Cloud Agreement        | Large cloud commit/deal.         |
| API Launch                   | Public/partner API launch.       |
| Enterprise AI Adoption       | Named enterprise AI rollout win. |

#### 19. ESG & Sustainability

ESG ratings, fines, and sustainability program milestones (often Later / paid).

| Subcategory           | Explanation                       |
| --------------------- | --------------------------------- |
| Carbon Credit Project | Material carbon-credit project.   |
| Sustainability Target | New/updated sustainability goals. |
| ESG Rating Upgrade    | Third-party ESG score improved.   |
| ESG Rating Downgrade  | Third-party ESG score worsened.   |
| Environmental Fine    | Material environmental penalty.   |

#### 20. Company Operations

Operating footprint, labor, and supply-chain execution events.

| Subcategory             | Explanation                          |
| ----------------------- | ------------------------------------ |
| Factory Opening         | New plant/site opens.                |
| Factory Closure         | Plant/site closes.                   |
| Capacity Expansion      | Production capacity increased.       |
| Layoffs                 | Workforce reduction announced.       |
| Hiring Surge            | Aggressive hiring plan/announcement. |
| Cost Reduction Program  | Formal cost-cut program.             |
| Supply Chain Disruption | Material supply interruption.        |
| Production Delay        | Output schedule slipped.             |

#### 21. Sector-Specific

Overlays — same ingest, sector-native sublabels for filters.

**Automotive**

| Subcategory                 | Explanation                                 |
| --------------------------- | ------------------------------------------- |
| Vehicle Launch              | New model launch.                           |
| Production Milestone        | Units/ramp milestone.                       |
| EV Tax Credit               | Credit eligibility change affecting demand. |
| Autonomous Driving Approval | AV regulatory approval milestone.           |
| Vehicle Recall              | Auto safety recall.                         |

**Banking**

| Subcategory                | Explanation                       |
| -------------------------- | --------------------------------- |
| Stress Test Results        | Regulatory stress-test outcome.   |
| Capital Requirement Change | Capital rule/buffer change.       |
| Loan Loss Provision        | Material credit provision change. |

**Airlines**

| Subcategory       | Explanation                           |
| ----------------- | ------------------------------------- |
| Route Expansion   | New routes announced.                 |
| Fleet Delivery    | Aircraft delivery milestone.          |
| FAA Certification | Airline/aircraft certification event. |

**Real Estate**

| Subcategory          | Explanation                    |
| -------------------- | ------------------------------ |
| Property Acquisition | Material property buy.         |
| Occupancy Update     | Occupancy/lease metric update. |
| Asset Sale           | Property/asset disposal.       |

**Mining**

| Subcategory       | Explanation                       |
| ----------------- | --------------------------------- |
| Resource Estimate | Resource/reserve estimate update. |
| Feasibility Study | PFS/DFS milestone.                |
| Drilling Results  | Exploration drill results.        |

#### 22. Market Sentiment

Secondary/sentiment overlays — useful context; not beachhead primary tape.

| Subcategory                       | Explanation                                   |
| --------------------------------- | --------------------------------------------- |
| Short Report Published            | Short-seller report drops.                    |
| Activist Report                   | Activist white paper / thesis publish.        |
| Rating Watch                      | Credit/equity rating placed on watch.         |
| Index Addition (e.g., S&P 500)    | Added to major index (forced flows).          |
| Index Removal                     | Removed from major index.                     |
| High Short Interest Alert         | Short interest crosses notable threshold.     |
| Unusual Options Activity          | Abnormal options flow (confluence, not core). |
| Significant Social Media Momentum | Viral social attention spike (noisy).         |

---

### Taxonomy usage notes

- **Product filters** should expose **Category** first; **Subcategory** in detail + advanced filters.
- **Sector-Specific** is an overlay, not a separate ingest family.
- **Management vs Insider & Ownership:** Form 4 can map to either; prefer Ownership for Form 4 clusters, Management for 8-K 5.02 leadership changes.
- **Prioritize for beachhead UI:** Earnings, M&A, Capital Markets, Management, Partnerships/Contracts, Legal/Disclosure, Exchange (halts), Insider — driven by EDGAR item codes where possible.

---

## 12. Free APIs for POC

**Goal:** Use several **free** (or free-tier) APIs → **normalize/filter into the taxonomy** → post catalysts to the feed for a credible POC — without pretending free sources equal a Benzinga-class wire.

**Honest constraint (from Sources & Schema):** There is **no free, redistributable, sub-second, full-taxonomy wire**. Free sources excel at **filings, exchange notices, calendars, and structured government data**. Editorial real-time news and many analyst/sentiment events are **paid**.

### Key free / free-tier sources → categories covered

| Source                                                                               | Cost / license                                                                        | Categories it can feed                                                                                                                                                                                            | Notes for POC                                                                       |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **SEC EDGAR** (Atom `getcurrent` + submissions; expand 8-K, Form 4, 13D/G, S-3/424B) | Free; ≤10 rps; proper User-Agent                                                      | Earnings (2.02), M&A, Capital Markets, Management (5.02), Partnerships/Contracts (1.01), Legal/Disclosure, Product (7.01/8.01), Insider & Ownership (Form 4 / 13D/G), Cyber (1.05), Exchange-adjacent disclosures | **Core beachhead.** Map item codes → category/subcategory. Already in product path. |
| **Nasdaq Trader Halt RSS**                                                           | Free; poll ≤1/min                                                                     | Exchange — Trading Halt, Halt Resumed (LULD / news-pending)                                                                                                                                                       | Must for day-trader tape; pair with resume events.                                  |
| **openFDA**                                                                          | Free key; rate limits                                                                 | FDA & Healthcare — Approval, Recall, Safety Warning, Label changes; some Product Recall                                                                                                                           | Near-RT–batch; entity→symbol map is the hard part.                                  |
| **ClinicalTrials.gov API v2**                                                        | Free; fair-use ~2 rps                                                                 | FDA & Healthcare — Clinical Trials phase/status changes, results posted                                                                                                                                           | Registry lag ≠ same-day PDUFA buzz; great for swing/event-driven.                   |
| **Finnhub free tier**                                                                | Free = **personal use**, ~60/min; **commercial redistribution needs paid/enterprise** | Earnings calendars; FDA AdCom calendar; company news; insider helpers; econ calendar                                                                                                                              | Excellent for **local/POC**. Do **not** ship commercial product on free ToS alone.  |
| **FRED API**                                                                         | Free key                                                                              | Macroeconomic — CPI, rates, employment, GDP, etc. as scheduled releases                                                                                                                                           | Event timestamps on release calendar; not continuous news.                          |
| **EIA Open Data** (optional Later)                                                   | Free key                                                                              | Energy & Commodities — inventory/supply prints                                                                                                                                                                    | Scheduled; complement to equity tape.                                               |
| **CISA KEV / agency RSS** (optional Later)                                           | Free                                                                                  | Cybersecurity hints; Regulatory (DOJ/FTC RSS)                                                                                                                                                                     | Need NLP + symbol resolution; sparse precision.                                     |
| **CourtListener / RECAP** (optional Later)                                           | Free/cheap                                                                            | Legal — docket milestones                                                                                                                                                                                         | Not a trading wire; event-driven research.                                          |

### What cannot be free / real-time (expect paid)

| Need                                           | Typical paid path                        | Why free fails                                    |
| ---------------------------------------------- | ---------------------------------------- | ------------------------------------------------- |
| Sub-second editorial catalyst wire             | Benzinga (direct or via Polygon/Massive) | No free redistributable equivalent                |
| High-quality Analyst Actions tape              | Benzinga analyst API / similar           | Free APIs weak on upgrades/PT with trader tagging |
| Same-day AdCom vote chatter / PDUFA desk notes | Biotech specialist wires                 | openFDA/CT.gov are structured, not desk rumor     |
| Full quotes + post-event move stats            | Polygon/Massive paid tiers               | Free quote tiers too thin for Historical Impact   |
| ESG rating changes                             | MSCI/LSEG-class vendors                  | Almost never free                                 |
| Social firehose / UOA as primary               | Unusual Whales / paid flow               | Out of beachhead lane anyway                      |

### Filtering strategy (POC pipeline)

```
Multi-source ingest
  → normalize (provider, externalId, url, event time, raw payload)
  → map to Category / Subcategory (+ 8-K itemCodes when EDGAR)
  → resolve symbol / company
  → dedupe (accession / content hash / time window)
  → score materiality (rules first; explainable)
  → playbook filter (watchlist · category · quiet mode · liquidity guards)
  → feed / alerts
```

**Principles:**

1. Prefer **few high-quality ingest jobs** + classification over one vendor per subcategory.
2. **EDGAR is system of record** for corporate disclosures; calendars (Finnhub/FRED) are _forward_ catalysts; openFDA/CT.gov deepen biotech.
3. Drop or down-rank low-confidence news without primary proof.
4. Label Finnhub free-tier use as **POC/personal** until commercial license.
5. Never fake “instant” — show event time and ingest lag.

### POC recommended order (free-first)

1. Harden **SEC EDGAR 8-K** item → taxonomy mapping (exists).
2. Add **Nasdaq Halt RSS** → Exchange.
3. Expand EDGAR: **Form 4**, **13D/G**, selected **S-3/424B**.
4. **Finnhub** earnings + FDA AdCom calendars (**personal/POC license**).
5. **openFDA** + **ClinicalTrials.gov** deltas for FDA & Healthcare.
6. **FRED** for macro session risk (optional strip, not firehose).
7. Paid wire (Benzinga/Polygon) only when free tape is trusted and beachhead retention is real.

---

## Bottom line

**Client:** Catalyst / event-driven day traders → swings → prop/educators.  
**Need:** Seconds-scale understanding of material events with proof, priority, and playbook fit.  
**Enemy:** Noise, headline-without-why, fragmented research, overconfident AI.  
**Wedge:** EDGAR-first intelligence + Act/Dismiss + quiet playbook.  
**Taxonomy:** Full 22-family tree (with every subcategory explained above) is the product language for classify → filter → learn.  
**POC sources:** Free EDGAR + Halt RSS + openFDA/CT.gov + FRED (+ Finnhub calendars under personal/POC license); paid wires for analyst/editorial realtime.  
**Truth:** Rule-based materiality + EDGAR pipeline + feed/playbook foundations are real; deep AI prediction, full historical analogs, and full-taxonomy coverage are the climb — label them as such.

---

_Combined summary for sharing. Downloads only — not a repository document._
