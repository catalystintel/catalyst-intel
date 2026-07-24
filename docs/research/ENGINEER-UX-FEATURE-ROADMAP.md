# Engineer UX / Feature Roadmap

**Audience:** Software engineers implementing Catalyst Intel  
**Purpose:** One place to see who we build for, which UX must ship, which Benzinga Pro–inspired ideas fit _this_ product, and the prioritized steps to take next.  
**Status:** Synthesis of existing research (Jul 2026) — not a new product invent  
**Codebase orientation:** Next.js desk app; live tape `/dashboard`; watchlist `/watchlist`; alerts `/alerts`; in-app Read `/dashboard/catalyst/[id]`; admin SEC fetch  
**Visual companion:** [`ENGINEER-UX-FEATURE-ROADMAP-VISUAL.md`](./ENGINEER-UX-FEATURE-ROADMAP-VISUAL.md) (Mermaid diagrams, swimlanes, priority matrix)

---

## How to use this doc

1. Read **§1 Target client** so you know who wins/loses if you add a feature.
2. Treat **§2 Must-have UX** as the product contract for daily use.
3. Use **§3 Benzinga-inspired (relevant only)** as a filter — borrow IA, do not clone the terminal.
4. Execute **§4 Prioritized engineering steps** in phase order; map work to listed routes/components.
5. Keep **§5 Out of scope** off the sprint unless product explicitly reopens it.

Inline citations point at source filenames under `docs/research/` (plus root `ACCEPTANCE-JTBD.md`).

---

## 1. Target client / persona (who + JTBD)

### Beachhead (build for these first)

| Persona                                    | Who                                                             | Core need                                                                                         |
| ------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **A — Catalyst day trader** (“Marcus”)     | Full-time / serious part-time US equities; gaps, AH, first hour | Fast EDGAR triage, impact tier, one-screen context, quiet mode after open                         |
| **B — Event-driven specialist** (“Priya”)  | Filings, FDA/calendar (later), M&A with confirmation, contracts | 8-K item taxonomy (esp. 1.01 / 2.02 / 5.02 / 7.01 / 8.01), proof links, float/mcap/sector filters |
| **C — Active swing around news** (“Elena”) | Holds hours–days around material events                         | High-signal watchlist alerts; less midday noise; lean + “priced in?” caution                      |

Sources: `Catalyst-Intel-Client-Target-Guideline.md`, `Catalyst-Intel-Client-Summary.md`, `Catalyst-Intel-Client-Architecture-and-Flow.md`.

### Primary JTBD

> When a filing or market-moving event hits, understand _what it is, why it matters, and whether it fits my playbook_ in seconds — then **Act or Dismiss** with confidence.

Job chain (same sources + `Catalyst-Intel-JTBD-UX-UI.md`):

1. **Detect** material catalysts at primary sources
2. **Classify** (category / 8-K item)
3. **Score** materiality / tradability (explainable)
4. **Contextualize** (why it matters; lean; history when available)
5. **Decide** Act vs Dismiss
6. **Monitor** watchlist / quiet playbook
7. **Learn** which catalyst types they trade well (later)

### Positioning wedge (protect this)

- Decision / triage layer for **event** traders — not a news firehose, not Bloomberg, not options-flow or technical scanning.
- Start at **primary source → taxonomy → materiality → Act/Dismiss**, then attach price/volume/history.
- Claim: clearer catalyst decisions with source proof and less noise.
- Do **not** claim: faster than Benzinga wire; Bloomberg killer; guaranteed edge; “verified AI” without source UX.

Sources: `Catalyst-Intel-Client-Target-Guideline.md` §§1–5, `Catalyst-Intel-Client-Summary.md` §§1–4.

### Explicit non-targets (for now)

Passive long-term research terminals · pure options-flow · pure technical scanners · institutional Bloomberg replacement · crypto-first / everything-news.

---

## 2. Must-have UX / UI (from research)

### Product principles (desk, not SaaS blog)

From `Catalyst-Intel-Client-Architecture-and-Flow.md` §5 and Client Target Guideline §12:

- Blotter density; first viewport = live tape
- Provenance first (Source, ET time, primary document link)
- Explainable scores (“Why this score?”)
- Quiet / playbook filters as a first-class feature
- Keyboard + alert dual path
- Charcoal / steel / amber desk language — not purple SaaS
- Order of truth: **Source > story > score > suggestion**

### Session-critical (P0) — daily use contract

From `Catalyst-Intel-Client-Target-Guideline.md` §7.1 and `Catalyst-Intel-Client-Summary.md` §7:

| #   | Requirement                               | Current codebase reality (JTBD preview)                                                                                                                                               |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Live catalyst feed                        | `/dashboard` soft-polls `/api/catalysts` (`live-catalyst-feed.tsx`)                                                                                                                   |
| 2   | Stable scannable row model                | Live grid: **Ticker/Event · Sector · Impact · Title · Proof · Time** (`Catalyst-Intel-JTBD-UX-UI.md`); older “Source \| Sector \| Title \| Time” copy is superseded for the live grid |
| 3   | Primary-source proof one click away       | `edgar-proof-link.tsx` + article secondary CTA (`ACCEPTANCE-JTBD.md` JTBD 3)                                                                                                          |
| 4   | **Act / Dismiss** (remember dismissals)   | Act opens Read/drawer; Dismiss = localStorage last 200 ids (not DB delete)                                                                                                            |
| 5   | Materiality badge + plain-language reason | `MaterialityBadge` rule-based High/Med/Low; deepen “why” copy                                                                                                                         |
| 6   | Category filters                          | Category chips + ticker / time window on feed                                                                                                                                         |
| 7   | Watchlist sync + highlight                | `/watchlist` + playbook API                                                                                                                                                           |
| 8   | Quiet playbook that reduces noise         | Quiet toggle + `matchesQuietPlaybook`                                                                                                                                                 |
| 9   | Reliable ticker / company identity        | Ongoing; ticker resolve quality is a trust metric                                                                                                                                     |
| 10  | Latency honesty                           | Show event time / last updated; never fake “instant” on cron/poll                                                                                                                     |
| 11  | Mobile-usable alert path                  | Desktop primary; alerts exist; push still stubbed                                                                                                                                     |

### Decision-quality (P0/P1)

Short grounded summary (3–6 bullets) · lean Bullish/Bearish/Neutral with uncertainty · market context strip (price / % / RVol) · liquidity guards (mcap / price / avg vol) · pre-market emphasis · duplicate suppression.

Sources: Client Target Guideline §7.2, Client Summary §7.

### Retention & trust (P1)

Alert prefs (category + min materiality + watchlist-only) · Act/Dismiss stats · historical analogs · always-visible score reasons · graceful failure when source/AI down.

### Five JTBD surfaces (implemented preview map)

From `Catalyst-Intel-JTBD-UX-UI.md` + `ACCEPTANCE-JTBD.md`:

| JTBD | Job                                                | Surface                                 |
| ---- | -------------------------------------------------- | --------------------------------------- |
| 1    | Filing → ticker + event + materiality; Act/Dismiss | `/dashboard` feed + Read                |
| 2    | Quiet tape → playbook-only                         | `/watchlist` + Quiet toggle on feed     |
| 3    | Headline → in-app article + original proof         | `/dashboard/catalyst/[id]` + Proof link |
| 4    | Away → webhook / email (push stub)                 | `/alerts`                               |
| 5    | Historical reaction context                        | Placeholder only — no fake numbers      |

Visual language reference (design-only): `Catalyst-Intel-JTBD-Visual-Preview-README.md` (charcoal / steel blue / amber).

### IA priority

**Feed → Watchlists → Alerts → Archive → Admin**  
(`Catalyst-Intel-Client-Architecture-and-Flow.md` §8; Client Summary §7).

Archive / Search is still a gap vs research IA — see §4 Phase 2.

---

## 3. Benzinga Pro–inspired features that fit _this_ product

Only features grounded in research docs. Goal: scannability + causality + calendars — **not** a Benzinga clone.

### Already applied / partially applied (do not re-invent)

From `Catalyst-Intel-Benzinga-Pro-Catalysts-Source-Map.md`:

| Idea                                                                                                    | CI stance                                     | Engineer note                                |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------- |
| Calendar-like panels via taxonomy (`earnings`, `regulatory`, `deals`, `capital`, `analyst`, `macro`, …) | Applied (Finnhub / EDGAR / FDA / macro paths) | Keep category → filter consistency           |
| SEC forms tagged with BZ calendar analogs (`bz:sec_filings`, etc.)                                      | Applied                                       | Read view “BZ panel” analog                  |
| Nasdaq halts                                                                                            | Applied (Halts parity)                        | Keep halt/resume pairing                     |
| Polygon Benzinga publisher → **Benzinga Wire** label                                                    | Applied when `POLYGON_API_KEY`                | License honesty: DIY packs ≠ redistribute    |
| **WIIM-lite** (`deriveWhyMoving` + optional session Δ)                                                  | Applied (lite)                                | Improve quality before buying editorial WIIM |
| Analyst Actions (partial) via Finnhub rec/PT                                                            | Partial                                       | Not a Street ratings firehose                |
| Macro calendar CPI / NFP / FOMC                                                                         | Applied (keyless schedule)                    | FRED live prints = later                     |

### Borrow for UX (article / feed IA) — relevant, not chrome

From `Catalyst-Intel-Benzinga-Like-Article-Display.md`:

| Priority | Feature                                                   | Why it fits CI                                         |
| -------- | --------------------------------------------------------- | ------------------------------------------------------ |
| **P0**   | WIIM-style one-liner above summary (“WHY IT'S MOVING”)    | Fastest triage upgrade; aligns with WIIM-lite pipeline |
| **P0**   | Bullet summary (3 short takeaways), not essay prose       | Matches trader scan behavior                           |
| **P1**   | Related ticker chips under primary ticker                 | Multi-symbol catalysts; needs related-symbol data      |
| **P1**   | Semantic Beats/Misses (and key catalyst verbs) highlights | Earnings Detail cards already lean this way            |
| **P2**   | Compact thumb + Δ since publish (non-hero)                | Needs media + quote; keep B&W desk, no magazine hero   |

**Mirror:** ticker-first hierarchy, causality one-liner, density over imagery, quick open-source actions.  
**Do not mirror:** loud green/red chrome everywhere, Squawk as v1, multi-panel workspace inside Read, magazine hero overlays.

In-app article behavior (proof stays secondary CTA): `Catalyst-Intel-Internal-Article-View.md`.

### Buy / license later (only when retention funds it)

From Benzinga source map §5 “Buy-next”:

1. Redistributable Wire (Benzinga / Massive **enterprise**)
2. Analyst ratings firehose (Benzinga Ratings / Intrinio / TipRanks)
3. UOA / Signals only if selling a Signals tier
4. Finnhub commercial if redistributing at scale
5. **Skip Squawk** until human desk budget (TTS over own tape ≠ Squawk)

### Explicitly not claimed / not cloneable cheaply

Squawk · UOA/Signals · Wire 15‑min exclusives · full Street ratings firehose · “Benzinga but faster” as brand promise.

---

## 4. Prioritized engineering steps (phased, actionable)

Phases merge Client Summary §10, Architecture §10, and current JTBD acceptance. Prefer hardening EDGAR + triage UX before buying Wire.

### Phase 0 — POC desk (mostly done; keep green)

**Outcome:** Demo-able blotter with honest data path.

- [ ] Keep SEC EDGAR 8-K path + admin/cron fetch reliable (`/api/admin/fetch/sec-edgar`)
- [ ] Preserve soft-poll feed + self-heal on stale (`GET /api/catalysts`)
- [ ] Auth gate + allowlisted admin
- [ ] QA against `ACCEPTANCE-JTBD.md` on `dev` Preview after every UX merge

**Touchpoints:** `live-catalyst-feed.tsx`, admin fetch trigger, ingest jobs under `src/lib/jobs/`.

### Phase 1 — Trustworthy tape (next engineering focus)

**Outcome:** Traders trust the tape for daily Act/Dismiss.

| Step | Work                                                                                 | Why / source                                         |
| ---- | ------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 1.1  | Explainable materiality: always show “Why this score?” in drawer + Read              | Client Target §7.3; Architecture M8                  |
| 1.2  | Harden 8-K item → category mapping (1.01, 2.02, 5.02, 7.01, 8.01 first)              | Client Target App B; Client Summary taxonomy notes   |
| 1.3  | Duplicate suppression across wires/filings                                           | Client Target §7.2                                   |
| 1.4  | Latency honesty UI: event time + ingest lag / last updated never implies wire-speed  | Client Target §7.1 #9; Architecture §4               |
| 1.5  | Scheduler reliability + freshness SLA signals (stale must scream)                    | Architecture S4/S7                                   |
| 1.6  | Liquidity guards: mcap / price / avg volume filters                                  | Client Target §7.2 #14                               |
| 1.7  | Read view P0 Benzinga IA: WIIM one-liner + bullet summary                            | `Catalyst-Intel-Benzinga-Like-Article-Display.md` §6 |
| 1.8  | Persist dismissals server-side (optional upgrade from localStorage) for multi-device | JTBD UX notes current local-only limit               |
| 1.9  | Onboarding forces playbook: categories + watchlist + quiet demo                      | Client Target §11                                    |

### Phase 2 — My desk (retention / paid-beta ready)

**Outcome:** Beachhead traders stay because the desk is _theirs_.

| Step | Work                                                                                    | Why / source                                                     |
| ---- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 2.1  | Alert depth: watchlist-only + category + min materiality; rate-limit; deep link to Read | Client Target §7.3; Architecture S2; `ACCEPTANCE-JTBD.md` JTBD 4 |
| 2.2  | Push channel (FCM or equivalent) — today stubbed                                        | JTBD 4 acceptance                                                |
| 2.3  | Archive / Search (ticker, accession, date) — IA gap                                     | Architecture §8; Client Summary IA                               |
| 2.4  | Saved playbook presets (“Offerings only”, “Biotech 8-K”, “Watchlist High”)              | Architecture S3                                                  |
| 2.5  | Market context strip on Read/drawer (last, %, RVol when keyed)                          | Client Target §7.2 #13                                           |
| 2.6  | Related ticker chips + Beats/Misses highlights                                          | Benzinga-Like Article Display P1                                 |
| 2.7  | Personal Act/Dismiss stats (discipline loop)                                            | Client Target §7.3 #18                                           |
| 2.8  | Billing-ready account shell when signal quality is sticky                               | Client Summary Phase 2                                           |

### Phase 3 — Multi-catalyst (same IA, new packs)

**Outcome:** Expand without losing SEC identity.

| Step | Work                                                                       | Why / source                                                   |
| ---- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 3.1  | FDA / ClinicalTrials as first-class tape citizens (same columns + proof)   | Client Target §6.2; Architecture Phase 3; Source Map FDA lanes |
| 3.2  | Historical reaction panel (real analogs only — replace JTBD 5 placeholder) | JTBD 5; Client Target historical moat notes                    |
| 3.3  | Expand EDGAR: Form 4 / 13D·G / S-3·424B quality + UI filters               | Client Summary free-API POC order                              |
| 3.4  | Optional FRED live macro prints (schedule already exists)                  | Source Map “Should later”                                      |
| 3.5  | Public API / webhooks for prop desks                                       | Architecture L5                                                |

### Phase 4 — Later bets (only with license + retention)

| Step | Work                                     | Gate                                                                     |
| ---- | ---------------------------------------- | ------------------------------------------------------------------------ |
| 4.1  | Enterprise Wire redistribute in Newsfeed | Paid contract (`Catalyst-Intel-Benzinga-Pro-Catalysts-Source-Map.md` §5) |
| 4.2  | Ratings firehose                         | Paid vendor                                                              |
| 4.3  | UOA / Signals tier                       | Explicit product tier + redistribute rider                               |
| 4.4  | Team / SSO / audit exports               | Prop expansion personas D                                                |
| 4.5  | Mobile PWA polish                        | JTBD 4 mobile path                                                       |
| 4.6  | PR wires with careful dedupe vs SEC      | Architecture L3                                                          |

### Suggested first tickets (if starting tomorrow)

1. **Read triage upgrade** — WIIM strip + bullet summary on `catalyst-article-view.tsx` (Benzinga-Like P0; uses existing WIIM-lite / summary fields).
2. **Score explainability** — surface rule reasons next to `MaterialityBadge` in drawer + article.
3. **Liquidity + category filter polish** on `live-catalyst-feed.tsx`.
4. **Alert prefs depth** on `alert-rules-panel.tsx` (watchlist-only, category).
5. **Acceptance pass** — tick `ACCEPTANCE-JTBD.md` on `dev` Preview; fix regressions before new chrome.

---

## 5. Out of scope / later (do not build unless asked)

From Client Target §7.4, Architecture Later table, Benzinga source map “Suggested only”:

| Out of scope now                                   | Reason                                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| Full charting platform                             | Wrong lane (Trade Ideas)                                                        |
| Broker / OMS / autotrader                          | Legal + focus                                                                   |
| Options-flow terminal / UOA as core                | Unusual Whales lane; paid + redistribute                                        |
| Macro/news magazine UX                             | Firehose churn                                                                  |
| Community chat as core loop                        | Not the decision product                                                        |
| Squawk audio desk                                  | No public equivalent; TTS ≠ Squawk                                              |
| Bloomberg replacement / multi-asset terminal       | Wrong buyer                                                                     |
| Claiming “real-time wire speed” on cron/poll alone | Trust destroyer                                                                 |
| Fake historical reaction numbers                   | Explicit JTBD 5 rule                                                            |
| Full 22-family taxonomy live on free APIs          | Product language ≠ current ingest coverage (`Catalyst-Intel-Client-Summary.md`) |
| Prop multi-seat SSO before retail FP rate is low   | Client Target GTM                                                               |

---

## 6. Built vs aspirational (label honestly in PRs)

| Built / in-product orientation                                           | Aspirational (do not overclaim)      |
| ------------------------------------------------------------------------ | ------------------------------------ |
| SEC EDGAR ingest + normalization                                         | Trusted AI lean / narrative as alpha |
| Supporting sources (openFDA, CT.gov, halts, Finnhub, Polygon when keyed) | Predictive “AI knows the move”       |
| Live feed + Quiet playbook + watchlist                                   | Rich similar-events outcome DB       |
| Rule-based materiality                                                   | Deep personalized alert intelligence |
| Alerts surface (webhook/email; push stub)                                | Enterprise Wire exclusives           |
| WIIM-lite + internal article view                                        | Full Benzinga calendar UX parity     |
| Auth / dashboard shell                                                   | Prop SSO / audit exports             |

Sources: Client Target §6, Client Summary §5, Benzinga Source Map Applied checklist.

---

## 7. Success signals (engineer-relevant)

From Client Target §9 / Client Summary §8 / Architecture §9:

- Activation: time-to-first Act/Dismiss &lt; ~2 min; watchlist or playbook set; ≥1 proof open
- Engagement: quiet-mode usage; healthy dismiss %; higher Act rate on High vs Low
- Trust: source-open on Acts; mute/unsubscribe rate; no silent wrong AI
- Pipeline: ingest lag p50/p95; accession dedupe 100%; ticker resolve &gt;95% on 8-K
- North star: high-materiality catalysts seen and decided **with proof** before secondary headline echo

---

## 8. Source index (read these, don’t reinvent)

| Doc                                                    | Use for                                          |
| ------------------------------------------------------ | ------------------------------------------------ |
| `Catalyst-Intel-Client-Target-Guideline.md`            | Personas, JTBD, must-haves, non-goals, messaging |
| `Catalyst-Intel-Client-Summary.md`                     | Condensed truth + taxonomy + free-API POC order  |
| `Catalyst-Intel-Client-Architecture-and-Flow.md`       | IA, backlog Must/Should/Later, phased roadmap    |
| `Catalyst-Intel-JTBD-UX-UI.md`                         | Implemented UI map + component paths             |
| `ACCEPTANCE-JTBD.md` (repo root)                       | QA checklist for Preview                         |
| `Catalyst-Intel-JTBD-Visual-Preview-README.md`         | Visual language (design-only)                    |
| `Catalyst-Intel-Internal-Article-View.md`              | In-app Read vs external proof                    |
| `Catalyst-Intel-Benzinga-Like-Article-Display.md`      | Which Benzinga article IA to borrow              |
| `Catalyst-Intel-Benzinga-Pro-Catalysts-Source-Map.md`  | Applied vs paid vs never-claim source lanes      |
| `Catalyst-Intel-Sources-and-Schema-Recommendation.md`  | Schema / source stack depth                      |
| `Catalyst-Intel-Persona-Data-Architecture-Proposal.md` | Persona ↔ data architecture (if needed)          |

---

_End of engineer roadmap. Prefer this file for sprint planning; prefer source docs when a detail conflicts — update this synthesis rather than silently diverging._
