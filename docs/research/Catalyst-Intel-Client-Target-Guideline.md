# Catalyst Intel — Client Target & Customer Needs Guideline

**Document type:** Founder / product strategy brief  
**Audience:** Founders, product, growth  
**Status:** Research-validated guideline (Jul 2026)  
**Scope:** Who the client is, what they need in the web app to use it daily and benefit, what is built vs aspirational

---

## 1. Executive verdict

Catalyst Intel wins by being the **decision layer for catalyst traders**, not another headline firehose and not a Bloomberg clone.

**Core job:** Help an active trader answer—in seconds—_Is this catalyst real, material, tradable for me right now, and what should I do next: act or dismiss?_

**Beachhead (correct and should stay narrow):**

- Primary: catalyst / news day traders and event-driven traders
- Source priority: **SEC EDGAR first** (especially Form 8-K item taxonomy), FDA / clinical later as expansion
- Positioning: **intelligence + triage**, not raw speed alone and not options-flow / technical scanning

**Product truth to protect:**

- Feed row mental model: `Source | Sector | Title | Time·date`
- JTBD actions: **Act** or **Dismiss**
- Quiet playbook mode (watchlist + category discipline)
- EDGAR proof (accession / primary-source link)
- Alerts that respect playbook, not spam

If the product drifts into “all news for everyone,” it becomes Benzinga-lite. If it drifts into “terminal for everything,” it becomes a failed Bloomberg. Stay in the catalyst decision lane.

---

## 2. Problem definition (verified)

### 2.1 The trader reality

Day and event-driven traders often decide in seconds to minutes. Edge half-life on material public catalysts is short:

- For widely followed names, the useful window after a material 8-K can be **~2–6 hours** before mainstream coverage and crowded flow.
- For less-covered small/mid caps, the window can stretch longer—but only if the trader can **find and trust** the filing fast.

Existing tools fail in different ways:

| Failure mode         | What traders experience                                        | Who typically causes it               |
| -------------------- | -------------------------------------------------------------- | ------------------------------------- |
| Firehose noise       | Hundreds of headlines; 99% not playable                        | Broad news desks / PR wires           |
| Headline without why | “Stock moving” without materiality or source proof             | Aggregators / social                  |
| Research tax         | Manual EDGAR dig + chart + volume + history                    | Fragmented workflow                   |
| False AI confidence  | Summaries that invent numbers or miss footnotes                | LLM wrappers without source grounding |
| Wrong tool for job   | Scanner finds move but not catalyst; flow tool ignores filings | Trade Ideas / Unusual Whales lanes    |

**Research note (AI claims):** Independent spot checks of AI-on-filings workflows show non-trivial error rates on numbers (~1 in 12 in one published check) and missed material disclosures when cross-docs are required. Therefore Catalyst Intel must treat AI as **triage + explanation**, always subordinate to **primary source proof** (EDGAR accession, FDA source URL). Never claim “verified AI truth.”

### 2.2 Jobs-to-be-done (JTBD)

1. **Detect** material catalysts as they hit primary sources.
2. **Classify** what kind of event it is (8-K item / FDA / halt / contract / etc.).
3. **Score** rough tradability / materiality for _my_ universe.
4. **Contextualize** in seconds: why it matters, bullish/bearish/neutral lean, similar history if available.
5. **Decide** Act vs Dismiss without drowning.
6. **Monitor** only my watchlist / playbook after the open (quiet mode).
7. **Learn** over time which catalyst types I actually trade well.

Primary JTBD statement:

> When a filing or market-moving event hits, I need to understand _what it is, why it matters, and whether it fits my playbook_ in seconds—so I can act or dismiss with confidence instead of missing the move or chasing noise.

---

## 3. Who the clients are

### 3.1 Beachhead (P0 — build for these first)

#### Persona A — Retail catalyst day trader (“Marcus”)

- **Who:** Full-time or serious part-time US equities day trader; often small/mid-cap + liquid large-cap catalysts.
- **Workflow:** Pre-market scan → gap / volume confirmation → trade open / first hour → manage into lunch; light afternoon catalyst watch.
- **Needs:** Fast EDGAR/news triage, impact tier, one-screen context, watchlist alerts, quiet mode after chaos settles.
- **Willingness to pay:** Already pays or considers $37–$200/mo tool stacks (Benzinga tiering is the reference band).
- **Success for them:** Fewer wasted clicks; higher % of alerts that are actually tradeable; faster Act/Dismiss.

#### Persona B — Event-driven / catalyst specialist (“Priya”)

- **Who:** Trades filings, FDA/calendar events, M&A rumors _with_ confirmation, contract awards—not pure technicals.
- **Workflow:** Source-first (EDGAR/FDA), then price/volume validation, then size by conviction and liquidity.
- **Needs:** Taxonomy accuracy (esp. 8-K items 1.01 / 2.02 / 5.02 / 7.01 / 8.01), proof links, historical analogs, filters by float/mcap/sector.
- **Success:** Primary-source edge before headline echo; structured journal of catalyst outcomes.

#### Persona C — Active swing trader around news (“Elena”)

- **Who:** Holds hours to days; cares about material events into/after earnings, FDA dates, SEC disclosures.
- **Needs:** High-signal alerts on watchlist, less intraday noise, clear bullish/bearish lean + “is this priced in?” caution.
- **Success:** Doesn’t miss overnight 8-Ks; avoids overtrading midday chatter.

### 3.2 Expansion (P1 — design for, don’t overbuild yet)

#### Persona D — Prop desk / prop firm trader

- **Needs:** Shared playbook categories, consistent taxonomy, auditability (source proof), low false-positive rate (risk desks hate noise).
- **Buy motion:** Often individual seat first; firm license later only after proven signal quality.
- **Caution:** Prop eval culture is risk-rule heavy; product should never imply auto-trading or guaranteed edge.

#### Persona E — Trading educator / community lead

- **Needs:** Clean examples, teachable taxonomy, shareable “why this mattered” breakdowns, not another squawk clone.
- **Value:** Distribution channel if product is crisp and non-spammy.

### 3.3 Explicit non-targets (for now)

- Passive long-term investors seeking portfolio research terminals
- Pure options-flow traders (Unusual Whales lane)
- Pure technical scanner traders (Trade Ideas lane)
- Institutional sell-side / Bloomberg terminal replacement buyers
- Crypto-first or multi-asset “everything news” users (later stubs exist; not beachhead)

**Positioning sentence:**  
_Catalyst Intel is for traders who trade **events**, not for traders who only trade **charts** or **flow**._

---

## 4. Competitive map (patterns, not feature envy)

| Player                        | Primary lane        | What they do well                                                                     | Gap Catalyst Intel can own                                                                                       |
| ----------------------------- | ------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Benzinga Pro**              | News speed + squawk | Sub-second headlines, WIIM-style “why moving,” filters on higher tiers (~$37–$197/mo) | Still a **news product**; noise remains; primary-source depth (EDGAR item intelligence) is not the core identity |
| **Trade Ideas**               | Technical discovery | Ranked scanners, pattern/AI setups                                                    | Weak on _why_ / filing semantics                                                                                 |
| **Unusual Whales**            | Options flow        | Flow, dark pool, Congress trades                                                      | Not a catalyst-filing decision system                                                                            |
| **EDGAR direct / DIY**        | Source of truth     | Free, authoritative                                                                   | Brutal UX; high research tax; no triage                                                                          |
| **Niche SEC/FDA alert tools** | Filing/FDA scanners | Domain focus                                                                          | Often thin context, weak product UX, or small-cap spam                                                           |

**Strategic wedge:**  
Be the product that starts at **primary source → taxonomy → materiality → Act/Dismiss**, then optionally attaches price/volume/history—rather than starting at headlines and hoping the trader reverse-engineers the filing.

**Do not claim:** “faster than Benzinga newsdesk” as the brand promise (hard to win; table-stakes arms race).  
**Do claim:** “clearer catalyst decisions with source proof and less noise.”

---

## 5. Value proposition (tight)

### 5.1 Customer value

- Real-time (or near-real-time) **market-moving catalysts** with **source provenance**
- Classification + prioritization by **impact / materiality**
- Seconds-scale **AI-assisted summaries** _grounded in the source_
- Unified view of **news + price/volume response + history** (roadmap completeness varies—label honestly)
- Personalized **watchlist / quiet playbook / alerts** so the feed stays usable all day

### 5.2 Differentiation (intelligence, not just speed)

1. **Taxonomy-first** (catalyst categories and 8-K item awareness)
2. **Materiality scoring** (rule-based now → AI-assisted later, always explainable)
3. **Act / Dismiss** interaction design (decision UX, not infinite scroll)
4. **Quiet playbook** (discipline as a product feature)
5. **EDGAR proof** (trust layer competitors underweight)
6. **Historical similar events** (aspirational core moat if executed with outcome data)

### 5.3 Why choose Catalyst Intel (founder pitch)

- Faster **understanding**, not only faster **headlines**
- Less manual filtering
- More confidence via source proof + structured lean
- Personalized to playbook
- AI that turns filings into **actionable triage**, not essay spam

---

## 6. Built vs aspirational (label clearly)

### 6.1 Built / in-product today (treat as current truth)

| Capability                                | Status note                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| SEC EDGAR ingest + catalyst normalization | Beachhead path; admin/cron fetch                                                            |
| Supporting sources in pipeline            | openFDA, ClinicalTrials, Nasdaq halts, Finnhub-related catalysts (quality varies by source) |
| Live feed UX                              | Source / sector / title / time; detail drawer                                               |
| Rule-based impact / materiality score     | Category-priority scoring 0–100 → High/Med/Low (schema notes AI scoring later)              |
| Taxonomy / categories                     | Shared event category keys for filter + ranking                                             |
| Watchlist                                 | First-class                                                                                 |
| Quiet playbook mode                       | Watchlist + playbook category filter                                                        |
| Alerts surface                            | Exists as product area                                                                      |
| Historical impact enrichment              | Partial (e.g., next-session style enrichment via market data jobs—not a full analog DB)     |
| Auth / dashboard / profile                | App shell for retained use                                                                  |

### 6.2 Aspirational / roadmap (do not overclaim in marketing)

| Capability                                                                | Honest framing                                                          |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Full AI narrative analysis + bullish/bearish/neutral with high trust      | Target; must keep source grounding + number verification UX             |
| True predictive impact scoring                                            | Not “AI knows the move”; prefer **explanatory + historical base rates** |
| Rich similar-events historical database                                   | Moat candidate; needs outcome labeling discipline                       |
| Deep personalized alert intelligence                                      | Beyond simple watchlist triggers                                        |
| Float / advanced liquidity filters as Benzinga-class                      | Valuable; not the differentiator alone                                  |
| Fully integrated price + volume + news timeline as polished research desk | Directionally right; polish and completeness TBD                        |
| FDA as co-equal beachhead                                                 | Expansion after EDGAR excellence                                        |
| Prop firm multi-seat admin / SSO / audit exports                          | P1/P2                                                                   |
| Squawk audio / social chat                                                | Non-goal unless strategic distribution requires it                      |

**Marketing rule:** Anything in §6.2 is “building toward,” never “ships as proven alpha.”

---

## 7. Must-have web app requirements (for active daily use)

### 7.1 Session-critical (P0)

1. **Live catalyst feed** with stable row schema: Source | Sector | Title | Time·date
2. **Primary source proof** one click away (EDGAR accession / filing URL)
3. **Act / Dismiss** (and remember dismissals for the session / user)
4. **Materiality badge** (High/Med/Low + score) with plain-language reason
5. **Category filters** (Earnings, FDA, M&A, SEC/8-K, Analyst, Contracts, Partnerships, Halts, Other…)
6. **Watchlist** sync + highlight
7. **Quiet playbook** toggle that actually reduces noise
8. **Symbol + company identity** reliable enough to trade against
9. **Latency honesty**: show event time; never fake “instant” if poll/cron based
10. **Mobile-usable alert path** (even if desktop is primary)—missed push = missed user

### 7.2 Decision-quality (P0/P1)

11. Short **AI/source summary** (3–6 bullets max) with “open source” CTA
12. **Lean:** Bullish / Bearish / Neutral + uncertainty flag when binary/unclear (e.g., 8.01 catch-all)
13. **Market context strip:** last price, % change, relative volume if available
14. **Liquidity guards:** mcap / price / average volume filters (prevent untradeable spam)
15. **Pre-market mode** emphasis (8-K edge is often AH → PM)
16. **Duplicate suppression** across wires/filings

### 7.3 Retention & trust (P1)

17. Alert preferences by category + min materiality + watchlist-only
18. Personal stats: acted vs dismissed, outcomes when measurable
19. Historical analogs panel (“similar 8-K item / sector, next-session distribution”)
20. Explainability: “Why this score?” always visible
21. Failure states: source down, delayed EDGAR, AI unavailable—graceful, never silent wrongness

### 7.4 Non-goals (protect focus)

- Not a full charting platform
- Not a broker / execution OMS
- Not options flow terminal
- Not macro/news magazine
- Not community chat as core loop
- Not “AI autotrader”
- Not Bloomberg replacement

---

## 8. Feature → need map

| Feature                                     | Customer need it serves         | Built / aspirational                                                         |
| ------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| Real-time (near-real-time) feed             | Detect before / as crowd reacts | Built (ingestion cadence dependent)                                          |
| AI summaries                                | Compress filing into seconds    | Aspirational / partial                                                       |
| Bullish/Bearish/Neutral                     | Instant lean                    | Aspirational (lean UX may exist in parts; trustable AI lean is aspirational) |
| Catalyst categories                         | Playbook filtering              | Built (taxonomy)                                                             |
| Impact score                                | Prioritize attention            | Built (rule-based); AI upgrade aspirational                                  |
| Watchlists + alerts                         | Personal relevance              | Built foundation                                                             |
| Filters (mcap, sector, type, float, volume) | Tradeable universe only         | Partial → expand                                                             |
| Historical DB / analogs                     | Confidence via base rates       | Partial enrichment → full DB aspirational                                    |
| Price/volume/news timeline                  | Unified research                | Partial → polish aspirational                                                |
| Quiet playbook                              | Anti-overload                   | Built                                                                        |
| EDGAR proof                                 | Trust / verification            | Built orientation                                                            |

---

## 9. Success metrics (product + business)

### 9.1 Activation (first session)

- Time-to-first **Act** or meaningful **Dismiss** < 2 minutes after signup
- User enables watchlist (≥3 symbols) or playbook categories in first session
- User opens ≥1 primary source proof (trust behavior)

### 9.2 Engagement (habitual use)

- DAU/WAU for beachhead cohort
- Medians: feed sessions per trading day; alerts opened vs ignored
- **Quiet mode usage rate** (discipline feature adoption)
- % of feed items dismissed (healthy if high—means triage works)
- Act rate on High materiality items (should be meaningfully higher than Low)

### 9.3 Quality / trust

- Source-open rate on acted items
- User-reported false positive rate (too many junk High scores)
- Alert unsubscribe / mute rate (spam detector)
- AI correction rate / “show source instead” clicks (if AI ships)

### 9.4 Outcome proxies (careful, non-overclaim)

- Optional: distribution of next-session returns for Acted High catalysts (research metric, not marketing guarantee)
- Retention D7/D30 among users with ≥5 Acts in week 1

### 9.5 Revenue (light validation)

Reference willingness-to-pay band from adjacent tools:

- News tools commonly monetize roughly **~$40–$200/mo** per serious retail seat (Benzinga Pro public tiers ~$37 / $147 / $197 as of 2026 references).
- Catalyst Intel should price for **clarity of decision**, likely mid-band once P0 trust features are sticky—not race to free firehose.

**Do not claim TAM theater.** Near-term opportunity is: convert a slice of catalyst traders already paying for noisy news into a sharper primary-source decision workflow—and expand to prop seats only after false positives are low.

---

## 10. Messaging guardrails

### Say

- “Primary-source catalysts, triaged for action.”
- “Act or dismiss in seconds—with EDGAR proof.”
- “Intelligence for event-driven traders.”
- “Built for playbooks, not doomscrolling.”

### Don’t say

- “Guaranteed edge / beat the market with AI.”
- “Bloomberg killer.”
- “Benzinga but faster” (as sole claim).
- “Verified AI” without source-check UX.
- “Real-time” if architecture is periodic cron without disclosing cadence.

---

## 11. Go-to-market implications (brief)

1. **Win EDGAR excellence first** (8-K item correctness, latency honesty, proof links).
2. Acquire via catalyst Twitter/Discord educators, filing-trade content, prop-trader communities—not generic “AI trading” ads.
3. Onboarding should force a playbook: categories + watchlist + quiet mode demo.
4. FDA/clinical expansion once SEC habit is formed (same UX, new source packs).
5. Prop/educator packaging after retail retention proves signal quality.

---

## 12. Recommended product principles (decisive)

1. **Source > story > score > suggestion.** Never reverse that order.
2. **Triage is the product.** If users still scroll endlessly, we failed.
3. **Quiet by default for power users.** Noise is churn.
4. **Explain every priority.** Opaque AI ranks destroy trust.
5. **Beachhead ruthlessly.** Event traders first; everyone else later.
6. **Label maturity honestly.** Built vs aspirational stays visible internally and in sales.

---

## 13. One-page summary

**Client:** Catalyst / event-driven day traders (then swings, prop, educators).  
**Need:** Seconds-scale understanding of material events with proof, priority, and playbook fit.  
**Enemy:** Noise, headline-without-why, fragmented research, overconfident AI.  
**Wedge:** EDGAR-first intelligence + Act/Dismiss + quiet playbook—not firehose speed wars.  
**Web app must-haves:** Feed, proof, score, filters, watchlist/alerts, quiet mode, lean/summary with grounding, liquidity filters, honest latency.  
**Non-goals:** Bloomberg, broker, flow terminal, chat, autotrader.  
**Truth:** Rule-based materiality + EDGAR pipeline are real today; deep AI impact prediction and full historical analogs are the climb—not the claim.

---

## Appendix A — Research inputs (Jul 2026)

- Event/catalyst trading literature and practitioner playbooks emphasize **Form 8-K item taxonomy** and pre-market windows; filings often precede mainstream headlines by hours.
- Competitor pattern synthesis: Benzinga = news speed; Trade Ideas = technical discovery; Unusual Whales = options flow; DIY EDGAR = truth with terrible UX.
- AI-on-filings caution: published practitioner checks show material hallucination/miss rates; product design must force source verification.
- Pricing band reference: Benzinga Pro public tiers commonly cited ~$37–$197/mo (2026), establishing retail willingness-to-pay for news intelligence seats.

## Appendix B — Category starter set (product taxonomy)

Earnings · Guidance · FDA / Clinical · M&A · SEC / 8-K (by item when possible) · Analyst · Contracts / Orders · Partnerships · Financing / Dilution · Insider · Halts · Management changes · Litigation / Regulatory · Other

Prioritize correctness on the high-frequency tradeable 8-K items (esp. 1.01, 2.02, 5.02, 7.01, 8.01) before expanding vanity categories.

---

_End of guideline. Save location: Downloads only. Not a repository document._
