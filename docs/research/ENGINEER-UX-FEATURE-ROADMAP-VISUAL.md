# Engineer UX / Feature Roadmap — Visual

**Companion to:** [`ENGINEER-UX-FEATURE-ROADMAP.md`](./ENGINEER-UX-FEATURE-ROADMAP.md) (full prose + tables)  
**Audience:** Engineers who want the same substance in diagrams, swimlanes, and checklists  
**Status:** Visual synthesis of existing research (Jul 2026) + **Clear news catalysts dashboard** acceptance (product JTBD Jul 2026) — not a new product invent  
**Sources:** filenames cited inline; full index in §8 of the prose roadmap

---

## Map of this doc

```mermaid
flowchart LR
  A[§1 Persona → JTBD → Surfaces] --> A2[§1A Dashboard acceptance]
  A2 --> B[§2 Phased roadmap 0–4]
  B --> C[§3 Benzinga vs Catalyst-native]
  C --> D[§4 Priority matrix]
  D --> E[§5 First tickets]
  E --> F[§6 Out of scope]
```

---

## 1. Persona → JTBD → product surfaces

### Beachhead personas (build for these first)

```mermaid
flowchart TB
  subgraph Beachhead["Beachhead clients"]
    A["A — Marcus<br/>Catalyst day trader<br/>Gaps / AH / first hour"]
    B["B — Priya<br/>Event-driven specialist<br/>8-K taxonomy + proof"]
    C["C — Elena<br/>Active swing around news<br/>High-signal alerts"]
  end

  JTBD["Primary JTBD<br/>What is it → why it matters → fit playbook<br/>→ Act or Dismiss"]

  A --> JTBD
  B --> JTBD
  C --> JTBD

  subgraph Surfaces["Five JTBD surfaces"]
    S1["JTBD 1 — Feed + Read<br/>/dashboard"]
    S2["JTBD 2 — Quiet playbook<br/>/watchlist + Quiet"]
    S3["JTBD 3 — Article + Proof<br/>/dashboard/catalyst/id"]
    S4["JTBD 4 — Away alerts<br/>/alerts"]
    S5["JTBD 5 — Historical analogs<br/>Placeholder only"]
  end

  JTBD --> S1
  JTBD --> S2
  JTBD --> S3
  JTBD --> S4
  JTBD --> S5
```

**Sources:** `Catalyst-Intel-Client-Target-Guideline.md`, `Catalyst-Intel-Client-Summary.md`, `Catalyst-Intel-JTBD-UX-UI.md`, `ACCEPTANCE-JTBD.md`.

### Job chain (Detect → Learn)

```mermaid
flowchart LR
  D[1 Detect] --> C[2 Classify]
  C --> S[3 Score]
  S --> X[4 Contextualize]
  X --> DEC[5 Decide<br/>Act / Dismiss]
  DEC --> M[6 Monitor<br/>Quiet / watchlist]
  M --> L[7 Learn<br/>later]
```

### Positioning wedge (protect this)

```text
┌─────────────────────────────────────────────────────────────┐
│  Decision / triage for EVENT traders                        │
│  Primary source → taxonomy → materiality → Act/Dismiss      │
│  then attach price / volume / history                       │
├──────────────────────────┬──────────────────────────────────┤
│  DO claim                │  DO NOT claim                    │
│  • Clearer decisions     │  • Faster than Benzinga wire     │
│  • Source proof          │  • Bloomberg killer              │
│  • Less noise            │  • Guaranteed edge               │
│                          │  • “Verified AI” without source  │
└──────────────────────────┴──────────────────────────────────┘
```

**Non-targets:** passive research terminals · options-flow · technical scanners · Bloomberg replacement · crypto-first.

**Sources:** `Catalyst-Intel-Client-Target-Guideline.md` §§1–5, `Catalyst-Intel-Client-Summary.md` §§1–4.

### IA priority (nav order)

```mermaid
flowchart LR
  F[Feed] --> W[Watchlists] --> A[Alerts] --> AR[Archive] --> AD[Admin]
```

Archive / Search is still a gap vs research IA → Phase 2.  
**Source:** `Catalyst-Intel-Client-Architecture-and-Flow.md` §8.

---

## 1A. Clear news catalysts dashboard — acceptance (product JTBD Jul 2026)

**Audience:** Engineers shipping feed / taxonomy / marketing-page work  
**Companion build rules:** [`ENGINEER-UX-UI-IMPLEMENTATION-GUIDE.md`](./ENGINEER-UX-UI-IMPLEMENTATION-GUIDE.md) §4 (column grammar), [`ENGINEER-UX-UI-GUIDE-SIMPLE.md`](./ENGINEER-UX-UI-GUIDE-SIMPLE.md) §3  
**Sources:** product JTBD (Jul 2026), `Catalyst-Intel-Benzinga-Pro-Catalysts-Source-Map.md`, `Catalyst-Intel-Sources-and-Schema-Recommendation.md`, `taxonomy.ts`

### Goals (engineer contract)

1. **Taxonomy ↔ API correlation:** Every catalyst subject that the product exposes as a dashboard filter must map to a real ingest path (`raw_sources.provider` → `catalysts.eventCategory` / subcategory) and must surface in the authenticated feed UI. Do not ship filter chips that return empty forever because no provider is wired.
2. **Day-trader desk efficiency:** Optimize the authenticated `/dashboard` for fast triage (dense rows, honest timestamps, symbol-first drill-down). Keep marketing chrome off the post-login tape.

### Product decision — main blotter columns

| Prior grammar (shipped / older docs)       | **New grammar (decision)**                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **Title · Time · Event · Ticker · Action** | **Symbol · Title · Time** (+ keep **Action** toolbar: Read / Dismiss / Quiet) — Symbol first |

**Do this:**

- Lead with **Symbol** as the row index (mono ticker / `—`), then **Title → Time**.
- Remove the primary Event column. Remove source details from dashboard rows: no Source column; do not append provider names under the title; strip provider prefixes from titles when present (`stripSourceNames` / equivalent).
- Keep Event/category available as filter chips and inside Read / drawer meta — not as a primary blotter column.
- Update `live-catalyst-feed.tsx`, feed-display helpers, and both engineer UX guides in the same PR as the UI change.

**Mobile stack:** Symbol (index col) + Title, with **Time** under Title (Event no longer in the primary stack).

### A. Default dashboard rows — acceptance

- [x] Desktop columns render **Symbol | Title | Time** in that order.
- [x] Action controls remain reachable without overlapping Time/Symbol.
- [x] Rows do not show source provider name, wire label strip, or Source column.
- [x] Title prefers headline / filing title with source names stripped.
- [x] Time remains event occurrence in **ET** (`catalysts.timestamp`); never DB insert time.
- [x] Symbol is mono; empty ticker shows `—` and is not clickable.

### B. Earnings filter — alternate column schema

When the **Earnings** filter chip is active, replace the default blotter columns with:

| Column         | Content                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| **Date**       | Earnings / report date (calendar or filing date — be explicit in UI)    |
| **Name**       | Company name                                                            |
| **Symbol**     | Ticker                                                                  |
| **Period**     | Fiscal quarter label only: **Q1 / Q2 / Q3 / Q4** (no free-text seasons) |
| **EPS**        | Reported EPS when known; otherwise `—`                                  |
| **Estimation** | Consensus / estimated EPS when known; otherwise `—`                     |

**API / schema implications:**

- Prefer Finnhub earnings calendar / surprise fields when keyed; enrich with SEC 8-K Item 2.02 rows classified as `earnings`.
- Persist or derive: `period` (quarter enum), `epsActual`, `epsEstimate` (map onto existing catalyst metadata / detail JSON — extend schema only if missing).
- Empty EPS/Estimation is allowed; do not invent numbers.

### C. Symbol click → drawer or split view

**Do this when the user clicks Symbol** on any row (default or earnings schema):

- [ ] Open existing drawer **or** split panel (`catalyst-detail-drawer.tsx` / `tape-split-panel.tsx`) — tape remains primary.
- [ ] Show a **price chart** for that symbol (reuse market quote / history paths; honest empty state if unkeyed).
- [ ] Show **updated quote details**: last price + %/absolute change across available timeframes (e.g. session, 1D, 5D, 1M — only what the API returns).
- [ ] Show **correlated news** for that symbol: catalysts/articles joined by ticker and/or keyword match on company/ticker; link into in-app Read.
- [ ] Do not navigate away from `/dashboard` for this interaction.

### D. Dashboard filter chips — UX order (decision)

Ship chips in this order (left → right). Rationale: default volume first, then highest day-trader cadence / materiality, then lower-frequency capital and macro/gov.

| #   | Chip label          | Maps to taxonomy / query                         |
| --- | ------------------- | ------------------------------------------------ |
| 1   | **All**             | No category filter (default)                     |
| 2   | **Earnings**        | `eventCategory = earnings` (+ earnings calendar) |
| 3   | **FDA Approvals**   | `regulatory` / FDA approval-class subcategories  |
| 4   | **Clinical Trials** | `clinical` / ClinicalTrials.gov updates          |
| 5   | **IPO**             | `capital` + IPO subcategories (`ipo*`)           |
| 6   | **Gov Reports**     | Gov / macro / SEC report-class events (see gaps) |

Do not randomize chip order. Additional taxonomy chips (halts, insider, analyst, …) may remain available behind All or secondary controls, but these six are the primary product filter set for this JTBD.

### E. Pre-login / marketing page (`src/app/page.tsx`)

**Do this:**

- [ ] Remove the fake / demo live tape preview and any “keys” / demo blotter from the pre-login page.
- [ ] Do **not** render an authenticated-style dashboard on the marketing surface.
- [ ] Lead with **real-time news catalysts** value: efficient triage, filtered catalyst topics, broad subject coverage.
- [ ] CTA → sign-in / sign-up only; no pretend live feed.

**Borrow patterns from trader-facing news sites (research notes — UX only, not a clone):**

| Site                               | Pattern to borrow                                                                                                                     | Do not copy                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Benzinga**                       | Hero promise of timely market-moving news; clear product CTA; social proof (desk / trader language) without embedding a full terminal | Loud multi-panel terminal chrome; Squawk; fake wire speed claims |
| **MarketWatch / Yahoo Finance**    | Plain value headline + “why sign in” clarity; topic coverage called out as categories                                                 | Dense magazine homepage as the product itself                    |
| **The Fly / Briefing-style desks** | Scarcity of chrome; “what moved / why” framing; professional tone                                                                     | Paywalled fake dashboards that look logged-in                    |

Concrete pre-login IA: **brand + one hero line + one supporting sentence + CTA group**. No demo tape, no filter chips, no keys strip.

### Filter → provider wiring (data / API gaps)

Engineers must treat each primary filter as an ingest + UI contract:

| Filter chip         | Primary providers / paths                                                                                                           | Status / gap                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **All**             | Union of wired providers via `GET /api/catalysts`                                                                                   | Keep green; empty only when ingest is down                                                                 |
| **Earnings**        | SEC EDGAR 8-K Item **2.02**; **Finnhub** `calendar/earnings` (+ surprises when keyed); optional Polygon/Benzinga reaction headlines | Calendar EPS/estimate fields may be thin — schema gap for Period/EPS/Estimation UI                         |
| **FDA Approvals**   | **openFDA**; Finnhub FDA / AdCom calendar; regulatory 8-K                                                                           | Approvals ≠ AdCom calendar — label honestly; same-day desk chatter still paid wire                         |
| **Clinical Trials** | **ClinicalTrials.gov** API v2 (`clinicaltrials` provider)                                                                           | Registry updates, not PDUFA buzz                                                                           |
| **IPO**             | **Finnhub** `/calendar/ipo` → `capital` / `ipo*`                                                                                    | **Thin** today — deepen before promising parity                                                            |
| **Gov Reports**     | **SEC EDGAR** (filings / 8-K disclosure); macro schedule (CPI/NFP/FOMC); later **FRED** live prints                                 | Product label spans SEC + macro — define subcategory map before UI ships; do not pretend full gov firehose |

**Related market data for Symbol panel:** Polygon (or Finnhub) quotes / aggregates when keyed; soft-fail empty chart if unkeyed.

```mermaid
flowchart LR
  subgraph Filters["Primary filter chips"]
    All --> Earn[Earnings]
    Earn --> FDA[FDA Approvals]
    FDA --> CT[Clinical Trials]
    CT --> IPO
    IPO --> Gov[Gov Reports]
  end

  Earn --> FH[Finnhub earnings + SEC 2.02]
  FDA --> OF[openFDA + Finnhub FDA cal]
  CT --> CTG[ClinicalTrials.gov]
  IPO --> FHI[Finnhub IPO calendar]
  Gov --> SEC[SEC EDGAR + macro schedule]
```

### Implementation tickets (imperative)

| ID  | Do this                                                                                                                             | Primary surfaces                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| D1  | Change default blotter to **Symbol · Title · Time**; strip source from rows                                                         | `live-catalyst-feed.tsx`, `feed-display.ts`                               |
| D2  | When Earnings filter active, switch column schema to **Date · Name · Symbol · Period · EPS · Estimation**                           | feed + earnings metadata API                                              |
| D3  | On Symbol click, open drawer/split with chart, multi-timeframe quote, correlated ticker news                                        | `tape-split-panel.tsx`, `catalyst-detail-drawer.tsx`, `/api/market/quote` |
| D4  | Reorder primary filter chips to All → Earnings → FDA Approvals → Clinical Trials → IPO → Gov Reports; wire each to taxonomy queries | feed filters + `taxonomy.ts`                                              |
| D5  | Audit each chip against ingest; fill provider gaps or hide chip until data exists                                                   | jobs under `src/lib/jobs/`, Source Map                                    |
| D6  | Rebuild pre-login page: no demo tape; hero value prop + CTA only                                                                    | `src/app/page.tsx`, `pre-login-chrome`                                    |
| D7  | Keep engineer guides in sync (this file + Implementation + Simple guides)                                                           | `docs/research/ENGINEER-UX-*.md`                                          |

### Sync rule

If implementation changes column grammar or primary filter order, update **this section**, [`ENGINEER-UX-UI-IMPLEMENTATION-GUIDE.md`](./ENGINEER-UX-UI-IMPLEMENTATION-GUIDE.md) §4, and [`ENGINEER-UX-UI-GUIDE-SIMPLE.md`](./ENGINEER-UX-UI-GUIDE-SIMPLE.md) §3 in the **same PR**.

---

## 2. Phased roadmap (0 → 4)

Prefer hardening EDGAR + triage UX before buying Wire.  
**Sources:** Client Summary §10, Architecture §10, `ACCEPTANCE-JTBD.md`.

```mermaid
flowchart TB
  P0["Phase 0 — POC desk<br/>MOSTLY DONE · keep green<br/>Demo-able blotter, honest data path"]
  P1["Phase 1 — Trustworthy tape<br/>NEXT FOCUS<br/>Traders trust daily Act/Dismiss"]
  P2["Phase 2 — My desk<br/>Retention / paid-beta ready<br/>Desk feels theirs"]
  P3["Phase 3 — Multi-catalyst<br/>Same IA, new packs<br/>FDA / Form 4 / history"]
  P4["Phase 4 — Later bets<br/>License + retention gates<br/>Wire / ratings / UOA / SSO"]

  P0 --> P1 --> P2 --> P3 --> P4
```

### Swimlane view (phase × workstream)

```mermaid
flowchart TB
  subgraph P0["Phase 0 — POC desk"]
    direction LR
    P0a[SEC EDGAR + cron] --- P0b[Soft-poll feed] --- P0c[Auth/admin] --- P0d[ACCEPTANCE QA]
  end

  subgraph P1["Phase 1 — Trustworthy tape"]
    direction LR
    P1a[Explainable score] --- P1b[8-K mapping] --- P1c[Dedupe + latency]
    P1d[Liquidity guards] --- P1e[WIIM + bullets] --- P1f[Playbook onboarding]
  end

  subgraph P2["Phase 2 — My desk"]
    direction LR
    P2a[Alert depth + push] --- P2b[Archive/Search] --- P2c[Presets + context]
    P2d[Related tickers] --- P2e[Act/Dismiss stats] --- P2f[Billing shell]
  end

  subgraph P3["Phase 3 — Multi-catalyst"]
    direction LR
    P3a[FDA / CT.gov] --- P3b[Real analogs] --- P3c[Form 4 / 13D] --- P3d[FRED + API]
  end

  subgraph P4["Phase 4 — Later bets"]
    direction LR
    P4a[Enterprise Wire] --- P4b[Ratings firehose] --- P4c[UOA tier] --- P4d[SSO / PWA]
  end

  P0 --> P1 --> P2 --> P3 --> P4
```

### Phase checklists (engineer-actionable)

#### Phase 0 — keep green

| Touchpoint                                      | Action                                   |
| ----------------------------------------------- | ---------------------------------------- |
| `/api/admin/fetch/sec-edgar`                    | Keep EDGAR 8-K path reliable             |
| `live-catalyst-feed.tsx` + `GET /api/catalysts` | Soft-poll + self-heal on stale           |
| Auth gate                                       | Allowlisted admin                        |
| `ACCEPTANCE-JTBD.md`                            | QA on `dev` Preview after every UX merge |

#### Phase 1 — next focus

| #   | Work                                              | Why / source                                         |
| --- | ------------------------------------------------- | ---------------------------------------------------- |
| 1.1 | “Why this score?” in drawer + Read                | Client Target §7.3; Architecture M8                  |
| 1.2 | Harden 8-K items 1.01 / 2.02 / 5.02 / 7.01 / 8.01 | Client Target App B                                  |
| 1.3 | Duplicate suppression                             | Client Target §7.2                                   |
| 1.4 | Latency honesty UI (event time + lag)             | Client Target §7.1 #9                                |
| 1.5 | Freshness SLA signals (stale must scream)         | Architecture S4/S7                                   |
| 1.6 | Liquidity guards (mcap / price / avg vol)         | Client Target §7.2 #14                               |
| 1.7 | Read P0: WIIM one-liner + bullet summary          | `Catalyst-Intel-Benzinga-Like-Article-Display.md` §6 |
| 1.8 | Persist dismissals server-side (optional)         | JTBD UX local-only limit                             |
| 1.9 | Onboarding forces playbook                        | Client Target §11                                    |

#### Phase 2 — retention

| #   | Work                                                | Why / source               |
| --- | --------------------------------------------------- | -------------------------- |
| 2.1 | Alert depth: watchlist + category + min materiality | Client Target §7.3; JTBD 4 |
| 2.2 | Push channel (FCM) — stubbed today                  | JTBD 4                     |
| 2.3 | Archive / Search (ticker, accession, date)          | Architecture §8            |
| 2.4 | Saved playbook presets                              | Architecture S3            |
| 2.5 | Market context strip on Read/drawer                 | Client Target §7.2 #13     |
| 2.6 | Related ticker chips + Beats/Misses                 | Benzinga-Like Article P1   |
| 2.7 | Personal Act/Dismiss stats                          | Client Target §7.3 #18     |
| 2.8 | Billing-ready account shell                         | Client Summary Phase 2     |

#### Phase 3 — expand packs

| #   | Work                                          | Why / source                   |
| --- | --------------------------------------------- | ------------------------------ |
| 3.1 | FDA / ClinicalTrials as first-class tape      | Client Target §6.2; Source Map |
| 3.2 | Historical reaction panel (real analogs only) | JTBD 5                         |
| 3.3 | Form 4 / 13D·G / S-3·424B + filters           | Client Summary POC order       |
| 3.4 | Optional FRED live macro prints               | Source Map “Should later”      |
| 3.5 | Public API / webhooks for prop desks          | Architecture L5                |

#### Phase 4 — gated bets

| #   | Work                                | Gate                          |
| --- | ----------------------------------- | ----------------------------- |
| 4.1 | Enterprise Wire in Newsfeed         | Paid contract — Source Map §5 |
| 4.2 | Ratings firehose                    | Paid vendor                   |
| 4.3 | UOA / Signals tier                  | Explicit product tier + rider |
| 4.4 | Team / SSO / audit exports          | Prop persona D                |
| 4.5 | Mobile PWA polish                   | JTBD 4 mobile                 |
| 4.6 | PR wires with careful dedupe vs SEC | Architecture L3               |

---

## 3. Benzinga-inspired vs Catalyst-native

Goal: scannability + causality + calendars — **not** a Benzinga clone.  
**Sources:** `Catalyst-Intel-Benzinga-Pro-Catalysts-Source-Map.md`, `Catalyst-Intel-Benzinga-Like-Article-Display.md`, `Catalyst-Intel-Internal-Article-View.md`.

```mermaid
flowchart TB
  subgraph Applied["Already applied / partial — do not reinvent"]
    A1[Taxonomy calendar panels]
    A2[SEC forms + BZ analogs]
    A3[Nasdaq halts]
    A4[Benzinga Wire label via Polygon]
    A5[WIIM-lite]
    A6[Analyst Actions partial]
    A7[Macro CPI/NFP/FOMC schedule]
  end

  subgraph Borrow["Borrow for UX — relevant IA"]
    B1["P0 WIIM one-liner"]
    B2["P0 Bullet summary"]
    B3["P1 Related ticker chips"]
    B4["P1 Beats/Misses highlights"]
    B5["P2 Compact thumb + Δ"]
  end

  subgraph BuyLater["Buy / license later"]
    C1[Enterprise Wire]
    C2[Ratings firehose]
    C3[UOA / Signals tier]
    C4[Finnhub commercial]
  end

  subgraph Never["Do not mirror / claim"]
    D1[Squawk as v1]
    D2[Loud green/red chrome]
    D3[Magazine hero overlays]
    D4["Benzinga but faster"]
  end
```

### Feature comparison matrix

| Feature                            | Origin              | CI stance              | Engineer note                        |
| ---------------------------------- | ------------------- | ---------------------- | ------------------------------------ |
| Category / calendar taxonomy       | BZ-inspired         | **Applied**            | Keep category → filter consistency   |
| SEC form → BZ panel analog         | BZ-inspired         | **Applied**            | Read view “BZ panel” analog          |
| Nasdaq halts                       | BZ-inspired         | **Applied**            | Halt/resume pairing                  |
| Wire label via Polygon publisher   | BZ-inspired         | **Applied** when keyed | License: DIY ≠ redistribute          |
| WIIM-lite (`deriveWhyMoving`)      | BZ-inspired         | **Applied (lite)**     | Improve before buying editorial WIIM |
| Analyst Actions (Finnhub)          | BZ-inspired         | **Partial**            | Not Street ratings firehose          |
| Macro schedule (CPI/NFP/FOMC)      | BZ-inspired         | **Applied**            | FRED live = later                    |
| WIIM one-liner above summary       | BZ article IA       | **Borrow P0**          | Fastest triage upgrade               |
| 3–6 bullet takeaways               | BZ article IA       | **Borrow P0**          | Scan behavior                        |
| Related ticker chips               | BZ article IA       | **Borrow P1**          | Needs related-symbol data            |
| Beats/Misses semantic highlights   | BZ article IA       | **Borrow P1**          | Earnings Detail lean                 |
| Compact thumb + Δ                  | BZ article IA       | **Borrow P2**          | No magazine hero                     |
| Enterprise Wire redistribute       | BZ buy              | **Later**              | Paid contract                        |
| Ratings firehose                   | BZ buy              | **Later**              | Paid vendor                          |
| UOA / Signals                      | BZ buy              | **Later**              | Only if Signals tier                 |
| Squawk                             | BZ                  | **Skip**               | TTS ≠ Squawk                         |
| Primary-source proof CTA           | **Catalyst-native** | Core                   | Proof stays secondary CTA in Read    |
| Quiet / playbook filters           | **Catalyst-native** | Core                   | First-class noise reduction          |
| Act / Dismiss loop                 | **Catalyst-native** | Core                   | Decision product, not firehose       |
| Explainable materiality            | **Catalyst-native** | Core                   | “Why this score?”                    |
| Rule order: Source > story > score | **Catalyst-native** | Core                   | Desk principles                      |

**Mirror:** ticker-first hierarchy, causality one-liner, density over imagery, quick open-source actions.  
**Do not mirror:** loud chrome, Squawk v1, multi-panel workspace inside Read, magazine heroes.

---

## 4. Priority matrix (P0 / P1 / P2)

### Session-critical UX (daily use contract) — P0

From Client Target §7.1 / Client Summary §7:

```mermaid
quadrantChart
    title Urgency vs decision impact
    x-axis Low impact --> High impact
    y-axis Can wait --> Ship now
    quadrant-1 P0 — ship now
    quadrant-2 Stretch / polish
    quadrant-3 Later / skip
    quadrant-4 P1 — next wave
    Live feed: [0.85, 0.92]
    Scannable row: [0.80, 0.90]
    Proof link: [0.88, 0.88]
    Act Dismiss: [0.90, 0.86]
    Materiality badge: [0.78, 0.84]
    Category filters: [0.70, 0.80]
    Watchlist sync: [0.72, 0.78]
    Quiet playbook: [0.75, 0.82]
    Ticker identity: [0.82, 0.76]
    Latency honesty: [0.74, 0.74]
    Mobile alerts: [0.55, 0.70]
    WIIM bullets: [0.77, 0.85]
    Score why: [0.80, 0.83]
    Liquidity guards: [0.68, 0.72]
    Alert depth: [0.65, 0.55]
    Archive search: [0.58, 0.48]
    Related tickers: [0.52, 0.45]
    Historical analogs: [0.70, 0.35]
    Enterprise Wire: [0.60, 0.20]
```

### Checklist by priority

#### P0 — must ship / harden

- [ ] Live catalyst feed (`/dashboard` → `/api/catalysts`)
- [ ] Stable row: **Symbol · Title · Time** (+ Action) — see §1A; Earnings filter uses Date · Name · Symbol · Period · EPS · Estimation
- [ ] Primary-source proof one click (`edgar-proof-link.tsx`)
- [ ] Act / Dismiss (remember dismissals)
- [ ] Materiality badge + plain-language reason
- [ ] Category filters + ticker / time window
- [ ] Watchlist sync + highlight
- [ ] Quiet playbook (`matchesQuietPlaybook`)
- [ ] Reliable ticker / company identity
- [ ] Latency honesty (never fake “instant”)
- [ ] Mobile-usable alert path (desktop primary; push stubbed)
- [ ] Read: WIIM one-liner + bullet summary (Benzinga-Like P0)
- [ ] Always-visible “Why this score?”

#### P1 — decision quality / retention

- [ ] Short grounded summary (3–6 bullets)
- [ ] Lean Bullish/Bearish/Neutral with uncertainty
- [ ] Market context strip (price / % / RVol)
- [ ] Liquidity guards (mcap / price / avg vol)
- [ ] Pre-market emphasis + duplicate suppression
- [ ] Alert prefs: category + min materiality + watchlist-only
- [ ] Act/Dismiss stats
- [ ] Related ticker chips + Beats/Misses
- [ ] Archive / Search
- [ ] Saved playbook presets
- [ ] Graceful failure when source/AI down

#### P2 — later / gated

- [ ] Compact thumb + Δ since publish
- [ ] Historical analogs (real data only — JTBD 5)
- [ ] FDA / Form 4 expansion
- [ ] Enterprise Wire / ratings / UOA (paid)
- [ ] Team SSO / audit / Mobile PWA polish

### Built vs aspirational (label honestly in PRs)

```text
BUILT / IN-PRODUCT                    ASPIRATIONAL (do not overclaim)
─────────────────────────────         ────────────────────────────────
SEC EDGAR + supporting sources        Trusted AI lean as alpha
Live feed + Quiet + watchlist         Rich similar-events outcome DB
Rule-based materiality                Deep personalized alert AI
Alerts (webhook/email; push stub)     Enterprise Wire exclusives
WIIM-lite + internal article          Full BZ calendar UX parity
Auth / dashboard shell                Prop SSO / audit exports
```

**Sources:** Client Target §6, Client Summary §5, Benzinga Source Map Applied checklist.

---

## 5. Suggested first tickets (start tomorrow)

```mermaid
flowchart LR
  T0["0. Dashboard JTBD<br/>Symbol/Title/Time + filters<br/>live-catalyst-feed.tsx"]
  T1["1. Read triage<br/>WIIM + bullets<br/>catalyst-article-view.tsx"]
  T2["2. Score explainability<br/>MaterialityBadge why<br/>drawer + article"]
  T3["3. Symbol panel<br/>chart + quote + related<br/>drawer / split"]  T4["4. Alert prefs depth<br/>alert-rules-panel.tsx"]
  T5["5. Acceptance pass<br/>ACCEPTANCE-JTBD.md<br/>on dev Preview"]

  T0 --> T1 --> T2 --> T3 --> T4 --> T5
```

| #   | Ticket                           | Files / surfaces                            | Source                   |
| --- | -------------------------------- | ------------------------------------------- | ------------------------ |
| 0   | Dashboard JTBD (columns/filters) | `live-catalyst-feed.tsx`, feed-display      | §1A product JTBD         |
| 1   | Read triage upgrade              | `catalyst-article-view.tsx`                 | Benzinga-Like P0         |
| 2   | Score explainability             | drawer + article next to `MaterialityBadge` | Client Target §7.3       |
| 3   | Symbol click panel               | drawer / `tape-split-panel.tsx` + quote API | §1A-C                    |
| 4   | Alert prefs depth                | `alert-rules-panel.tsx`                     | JTBD 4 / Architecture S2 |
| 5   | Acceptance pass on `dev` Preview | `ACCEPTANCE-JTBD.md`                        | Fix before new chrome    |

---

## 6. Out of scope (do not build unless asked)

```mermaid
mindmap
  root((Out of scope now))
    Wrong lane
      Full charting
      Broker / OMS
      Options-flow core
      Bloomberg replacement
    Trust destroyers
      Fake wire speed on poll
      Fake historical numbers
      Verified AI without source
    Premature
      Squawk desk
      Community chat core
      Full 22-family taxonomy on free APIs
      Prop SSO before retail FP is low
    Wrong UX
      Macro/news magazine
```

| Out of scope                         | Reason                     |
| ------------------------------------ | -------------------------- |
| Full charting platform               | Wrong lane (Trade Ideas)   |
| Broker / OMS / autotrader            | Legal + focus              |
| Options-flow / UOA as core           | Unusual Whales lane        |
| Macro/news magazine UX               | Firehose churn             |
| Community chat as core               | Not the decision product   |
| Squawk audio desk                    | No public equivalent       |
| Bloomberg / multi-asset terminal     | Wrong buyer                |
| “Real-time wire speed” on cron/poll  | Trust destroyer            |
| Fake historical reaction numbers     | JTBD 5 rule                |
| Full 22-family taxonomy on free APIs | Language ≠ ingest coverage |
| Prop multi-seat SSO early            | Client Target GTM          |

**Sources:** Client Target §7.4, Architecture Later table, Benzinga source map “Suggested only”.

---

## 7. Success signals (at a glance)

```mermaid
flowchart TB
  subgraph Activation
    A1["Time-to-first Act/Dismiss &lt; ~2 min"]
    A2[Watchlist or playbook set]
    A3["≥1 proof open"]
  end
  subgraph Engagement
    E1[Quiet-mode usage]
    E2[Healthy dismiss %]
    E3[Higher Act on High vs Low]
  end
  subgraph Trust
    T1[Source-open on Acts]
    T2[Mute / unsubscribe rate]
    T3[No silent wrong AI]
  end
  subgraph Pipeline
    P1[Ingest lag p50/p95]
    P2[Accession dedupe 100%]
    P3["Ticker resolve &gt;95% on 8-K"]
  end
  NS["North star: high-materiality seen + decided WITH PROOF<br/>before secondary headline echo"]
  Activation --> NS
  Engagement --> NS
  Trust --> NS
  Pipeline --> NS
```

**Sources:** Client Target §9, Client Summary §8, Architecture §9.

---

## 8. Source index

| Doc                                                                                  | Use for                                    |
| ------------------------------------------------------------------------------------ | ------------------------------------------ |
| [`ENGINEER-UX-FEATURE-ROADMAP.md`](./ENGINEER-UX-FEATURE-ROADMAP.md)                 | Full prose companion (this file is visual) |
| `Catalyst-Intel-Client-Target-Guideline.md`                                          | Personas, JTBD, must-haves, non-goals      |
| `Catalyst-Intel-Client-Summary.md`                                                   | Condensed truth + taxonomy + POC order     |
| `Catalyst-Intel-Client-Architecture-and-Flow.md`                                     | IA, backlog, phased roadmap                |
| `Catalyst-Intel-JTBD-UX-UI.md`                                                       | Implemented UI map + component paths       |
| `ACCEPTANCE-JTBD.md` (repo root)                                                     | QA checklist for Preview                   |
| `Catalyst-Intel-JTBD-Visual-Preview-README.md`                                       | Visual language (design-only)              |
| `Catalyst-Intel-Internal-Article-View.md`                                            | In-app Read vs external proof              |
| `Catalyst-Intel-Benzinga-Like-Article-Display.md`                                    | Which BZ article IA to borrow              |
| `Catalyst-Intel-Benzinga-Pro-Catalysts-Source-Map.md`                                | Applied vs paid vs never-claim             |
| `Catalyst-Intel-Sources-and-Schema-Recommendation.md`                                | Schema / source stack                      |
| `Catalyst-Intel-Persona-Data-Architecture-Proposal.md`                               | Persona ↔ data architecture                |
| [`ENGINEER-UX-UI-IMPLEMENTATION-GUIDE.md`](./ENGINEER-UX-UI-IMPLEMENTATION-GUIDE.md) | Build contract; §4 column grammar          |
| [`ENGINEER-UX-UI-GUIDE-SIMPLE.md`](./ENGINEER-UX-UI-GUIDE-SIMPLE.md)                 | Short feed / column rules                  |
| §1A (this file)                                                                      | Clear news catalysts dashboard acceptance  |

---

_Prefer the [prose roadmap](./ENGINEER-UX-FEATURE-ROADMAP.md) for sprint copy-paste detail; prefer this file for onboarding / planning walls. If a detail conflicts with a source research doc, update the synthesis — don’t silently diverge._
