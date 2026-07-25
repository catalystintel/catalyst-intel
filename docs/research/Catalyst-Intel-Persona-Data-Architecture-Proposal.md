# Catalyst Intel — Persona-Prioritized Data Architecture Proposal

**Status:** Awaiting your approval before implementation/deploy  
**Date:** 2026-07-20 (rev 2 — trader desk design language)  
**Scope:** Proposal only — no code changes, no cron changes, no PR to `dev`/`main`, no deploy  
**Artifacts:**

- Sketch: `C:\Users\user\Downloads\Catalyst-Intel-Persona-Data-Architecture-Sketch.png`
- This brief: `C:\Users\user\Downloads\Catalyst-Intel-Persona-Data-Architecture-Proposal.md`
- UX reference: `C:\Users\user\Downloads\catalyst-intel-ux-mock\index.html` (Live feed v3 column model)

---

## 1. Current state (grounding)

| Area        | Today                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ingest**  | SEC EDGAR **8-K Atom only** (`type=8-K&output=atom&count=100`)                                                                              |
| **Cadence** | GitHub Actions `*/5` (best-effort; observed gaps often ~hourly); local cron default 2 min; feed GET backstop if stale >10 min               |
| **Parse**   | Atom summary → Item codes → category + headline; no full filing body / EX-99 text                                                           |
| **Store**   | `raw_sources` → `catalysts` (+ `companies` upsert); 30-day retention                                                                        |
| **Feed UI** | Columns **Source \| Sector \| Title \| Time·date**; client filters (symbol, category, 1h/4h/24h/All); poll 20s focused                      |
| **Gaps**    | `impact_score` / `summary` unused; watchlists/alerts nav-only; `companies.sector` never populated; “Sector” column shows **event category** |

**Known item catalog:** 1.01–1.04, 2.01–2.06, 3.01–3.03, 4.01–4.02, 5.01–5.05, 5.07–5.08, 7.01, 8.01, 9.01.  
**Missing from catalog:** **Item 1.05** (material cybersecurity incident) — high day-trader relevance.

---

## 2. Design system (trader desk — website + docs)

Rev 1 sketches read as generic SaaS. Rev 2 targets **desk density**: function over decoration, amber/charcoal recognition, monospace times, semantic color reserved for market state — not chrome.

### 2.1 External references (what informed this)

| Topic                                 | Source                                                                                                                                                                                                                                                                                                                                                                                                          | Takeaway we adopt                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Terminal density & expert workflows   | [Bloomberg Terminal case study — data viz density](https://datafield.dev/data-visualization-python/part-05/chapter-21/case-study-01.html); [Bloomberg design ethos (black + amber)](https://www.bloomberg.com/company/stories/bloombergs-customer-centric-design-ethos/); [Launchpad / multi-monitor](https://www.bloomberg.com/ux/2017/11/10/relaunching-launchpad-disguising-ux-revolution-within-evolution/) | High data density is a feature for power users; black/amber is the floor hallmark; multi-component workspaces |
| Consistency under noise               | [Bloomberg UX — consistency](https://www.bloomberg.com/ux/2020/08/11/consistency-more-than-just-a-buzzword/)                                                                                                                                                                                                                                                                                                    | Predictable chrome so traders scan the _data_, not the UI                                                     |
| Fintech dark surfaces & status colors | [ColorArchive — Dark Mode for Fintech/Trading](https://colorarchive.org/guides/fintech-dark-mode-colors/)                                                                                                                                                                                                                                                                                                       | Charcoal/navy base (not pure black); ≥5 distinguishable status colors; green/red light enough to read on dark |
| Trader psychology / density           | [Psychology-Driven Layouts for Traders (Bootcamp)](https://medium.com/design-bootcamp/psychology-driven-layouts-designing-for-how-traders-think-b11e2e7cac5c)                                                                                                                                                                                                                                                   | Compact grids, persist layout/filters, responsive row flash on update, avoid modal interruption               |
| Trading app hierarchy & a11y          | [Lollypop — Trading App Design 2026](https://lollypop.design/blog/2026/june/trading-app-design/)                                                                                                                                                                                                                                                                                                                | Clear hierarchy; red/green alone insufficient — pair with badges/labels                                       |
| Blotter / workspace patterns          | [IBKR TWS Blotter](https://www.interactivebrokers.co.uk/en/software/tws.bak/usersguidebook/specializedorderentry/understand_the_blotter_interface.htm); [TWS Layout Library](https://www.interactivebrokers.com/en/trading/tws-workspace-layout-library.php)                                                                                                                                                    | Single dense window for tickets/status; saved layouts across monitors                                         |
| News table density                    | [Axiom Terminal — News Feed table view](https://docs.axiomterminal.com/features/news-feed)                                                                                                                                                                                                                                                                                                                      | Table > cards for scanning: Date/Time · Symbol · Title · Source; sort by headers                              |
| Architecture diagram aesthetics       | [C4 model](https://c4model.com/); [InfoQ — C4 (legend + unambiguous labels)](https://www.infoq.com/articles/C4-architecture-model/)                                                                                                                                                                                                                                                                             | Nested boxes, title + legend, audience-specific zoom — no purple neon SaaS flowcharts                         |

### 2.2 Color tokens (proposed product chrome)

| Token                  | Hex (approx)                             | Use                                                     |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------- |
| `--bg-app`             | `#0E1116` / `#0B111A`                    | App canvas (charcoal, not pure black)                   |
| `--bg-panel`           | `#161B22` / `#111821`                    | Blotter / sidebar elevation                             |
| `--border`             | `#1C2736`                                | Hairline separators only                                |
| `--text`               | `#E8EAED` / `#E6EDF7`                    | Primary titles & body                                   |
| `--text-muted`         | `#7B8A9E`                                | Column headers, secondary meta                          |
| `--steel`              | `#5B7C99` / `#4F8FD9` (accent sparingly) | Source type chrome, links, focus rings                  |
| `--amber`              | `#C9A227` / `#F0C14B`                    | **LIVE**, halt urgency, active filter, desk “attention” |
| `--up` / resume        | `#3DDC97` (muted)                        | Resume / positive **state only** — never brand fill     |
| `--down` / halt-severe | `#E85D5D` (muted)                        | Severe halt / loss **state only** — never brand fill    |
| `--mono`               | IBM Plex Mono / JetBrains Mono           | Symbols, times, codes                                   |

**Rules:** Green/red are **semantic only** (P&L / halt-resume / flash). Amber = attention. Steel blue = structure. No purple gradients, no neon glow, no rainbow chip walls.

### 2.3 Type & density

| Element    | Spec                                                                               |
| ---------- | ---------------------------------------------------------------------------------- |
| UI sans    | DM Sans / similar (existing mock) — labels, titles                                 |
| Mono       | IBM Plex Mono — Source codes, Time·date, session clock                             |
| Row height | Target **44–56px** (tighter than marketing cards; denser than consumer news)       |
| Columns    | Fixed or sticky widths; header sort affordance; no card grid for primary Live tape |
| Motion     | Brief row flash on insert (amber edge or bg pulse ≤400ms); no decorative animation |

### 2.4 Architecture diagram style (docs / sketch)

Follow C4 container-level habits: titled diagram, nested boxes, directed labeled arrows, **legend**, persona callouts as audience — charcoal canvas, steel borders, amber only for P1 emphasis. Avoid decorative 3D, purple SaaS pipelines, and emoji-heavy flowcharts.

---

## 3. Personas → data needs

| Priority | Persona                    | Job to be done                                                  | Latency SLA                              | Must-have data                                                                    | Nice-to-have                                                           | Product surface                                 |
| -------- | -------------------------- | --------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- |
| **P1**   | Catalyst day trader        | Long/short/skip before crowd on gaps, halt resumes, AH bombs    | **Seconds–~1 min** during 06:00–16:00 ET | Faster reliable 8-K; **halt/resume**; material item filter; AH/pre-market density | EX-99 headline extract; Form 6-K (ADRs); offering docs when they print | Live blotter + flash; halt badges / sound later |
| **P2**   | Event-driven / news trader | Offerings, M&A, guidance, investigations; charts + L2 elsewhere | **1–5 min**                              | Event-type + symbol playbook filters; capital/M&A/guidance tags; less noise       | Press wires; Form 4; earnings calendar                                 | Filters by event type; Source multi-provider    |
| **P3**   | Catalyst swing             | Days–weeks around filings / PDUFA                               | **Hours–daily**                          | Forward calendar + scored past events                                             | ClinicalTrials.gov; openFDA actions                                    | Calendar view + scored history                  |
| **P4**   | Solo analyst / small prop  | Watchlists, audit, history; API later                           | **Reliable > sub-second**                | Stable ingest, search, retention beyond 30d optional                              | Public API, export                                                     | Watchlists, audit trail, history                |

---

## 4. Website data display (Live blotter) — trader convenience

Keep the Live feed v3 column model (**Source \| Sector \| Title \| Time·date**) but upgrade semantics, density, and urgency so the tape behaves like a desk blotter, not a blog.

### 4.1 Concrete display rules

1. **Column scan order (L→R):** Source (provider·symbol) → Sector (industry) → Title (headline + inline badge) → Time·date (mono, ET). Match Axiom-style table density; do not demote Time into relative “2m ago” as primary.
2. **Session clock always visible (ET):** `HH:MM:SS ET · PRE|RTH|AH` in the top bar so traders never leave context for “what session is this?”
3. **Urgency chrome is amber, not red walls:** `HALT` rows get amber Source pill + inline `[HALT]` badge; `RESUME` gets muted green label only. Reserve saturated red for rare severe codes if needed — never paint the whole chrome red/green.
4. **Playbook filters as a single chip row:** Halt · Capital · Deals · Earnings · Distress · Cyber (+ All). Active chip = amber underline/text (Bloomberg-like attention), not a rainbow of filled pills.
5. **Sort & sticky headers:** Default newest-first; click Time·date / Source; sticky header on scroll. New rows flash once so multi-monitor peripheral vision catches inserts (Bootcamp trader-layout pattern).
6. **Source string format:** `HALT · NVDA`, `8-K · TSLA`, `424B · SOFI`, `PR · MRK` — monospace symbol, steel/amber by severity. Sector = **industry** (or `—` until populated); event category lives as badge under/ beside Title, never masquerading as Sector.
7. **Title line carries the decision text:** Halt reason + code (`T3 News pending`); Item headline (`Item 1.05 — …`); offering/PR as printed. Truncate with ellipsis; full text on hover/detail — keep row height stable.

### 4.2 Column contract

| Column        | Current                      | Proposed                                                                                |
| ------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| **Source**    | `SEC EDGAR` + `8-K · SYMBOL` | Provider brand + type (`HALT · NVDA`, `8-K · NVDA`, `PR · …`); severity color sparingly |
| **Sector**    | Event category (misnamed)    | **Industry** from `companies.sector`; fallback `—`; category → badge on Title           |
| **Title**     | Headline / filing title      | Halt / Item / wire decision text + inline urgency badge                                 |
| **Time·date** | `10:23 AM · Jul 20, 2026`    | Same pattern; **always ET**; optional `AH`/`PRE` meta chip later                        |

### 4.3 Filters (evolve, still client-first)

- Keep: symbol, time window (1h / 4h / 24h / All), category
- Add: Source provider multi-select; **Halt / Resume**; Capital / Deals / Earnings / Distress / Cyber
- Later: watchlist-only; min `impact_score`

**Alerts:** schema + rules later (P1 wants halt + high-impact 8-K push). Do not block feed architecture on alerts.

---

## 5. Missing real-time data (beyond current 8-K Atom)

Realistic free vs paid. Prefer free first for P1; paid only when latency/ToS justify it.

### 5.1 Must for P1 (day trader)

| Data                                   | Why                               | Source options                                                         | Cost / constraints                                       |
| -------------------------------------- | --------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| **Trading halt / resume / LULD pause** | Desk’s #1 “seconds matter” signal | **Nasdaq Trader Trade Halt RSS** — free; ~1/min; do not poll faster    | Free; ToS + ≤1 query/min                                 |
| **Tighter SEC freshness**              | GHA gaps undermine “seconds”      | Dedicated runner **15–60s** in session hours; Atom as index            | Free EDGAR; **10 req/s**; require `SEC_EDGAR_USER_AGENT` |
| **Item 1.05 + noise rules**            | Cyber + drop pure 9.01 noise      | Extend existing parser                                                 | Free eng                                                 |
| **Material exhibit / body peek**       | Atom titles weak for AH bombs     | Fetch primary HTML/txt for **new** 8-Ks; EX-99 headline / Item snippet | Free; queue, rate-limit                                  |
| **Additional SEC forms (narrow)**      | Capital / ADR prints outside 8-K  | Atom for **6-K**, **424B***, **S-3/S-3MEF**, maybe **F-3**             | Free; stronger filters                                   |

### 5.2 Should for P2 (event trader)

| Data                            | Why                            | Source options                              | Cost / constraints            |
| ------------------------------- | ------------------------------ | ------------------------------------------- | ----------------------------- |
| **Press releases (wires)**      | Often print before/with filing | Free/delayed public RSS; paid Benzinga etc. | Free = lag + ToS; paid = $$$$ |
| **Form 4 (insider)**            | Clusters / unusual sells       | EDGAR Atom `type=4`                         | High volume → watchlist later |
| **Earnings / guidance tagging** | 2.02 + 7.01 + wire “guidance”  | Rule tags + later LLM                       | Mostly free                   |
| **Industry sector**             | Column honesty                 | SIC → coarse sector or Finnhub/Polygon free | Free/cheap                    |

### 5.3 Later for P3 / P4

PDUFA/AdCom calendar (DIY incomplete; paid curated), openFDA, ClinicalTrials.gov, longer retention, FTS, watchlists/alerts, public API — unchanged intent from rev 1.

### Explicitly out of scope for v1

Sub-second Bloomberg/Refinitiv filings; L2/charts; unusual options; scraping paid calendars without license.

---

## 6. Proposed architecture & cron flow (persona-ordered)

C4-ish container view (see sketch left panel):

```
[Session hours 06:00–16:00 ET]          [Off-hours / weekends]
P1 loop 15–60s ─────────────────────►   P1 loop 2–5 min
  ├─ SEC 8-K Atom (+ optional form feeds)
  ├─ Halt/Resume RSS (≤1/min)
  └─ Queue: body/EX-99 extract for NEW accessions only
P2 loop 1–5 min ─────────────────────►  P2 hourly
  ├─ Press RSS or paid wire (if approved)
  └─ Form 4 (optional / watchlist later)
P3 loop hourly / daily ───────────────►  P3 daily
  ├─ openFDA actions/recalls
  ├─ ClinicalTrials delta
  └─ Calendar rebuild from filings/PR
Normalize → raw_sources → catalysts
Score/filter hooks → Live Blotter / Calendar / (Alerts later)
```

### Normalize fields (shared event model)

| Field                    | Purpose                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `provider`               | `sec-edgar`, `nasdaq-halts`, `press-wire`, `openfda`, …                                                                 |
| `external_id`            | Stable dedupe                                                                                                           |
| `type`                   | `8-K`, `HALT`, `RESUME`, `PR`, `PDUFA`, …                                                                               |
| `event_category`         | Playbook bucket (`halt`, `regulatory`, `insider`, …)                                                                    |
| `headline` / `title`     | Trader-facing title                                                                                                     |
| `symbol`, `company_name` | Identity                                                                                                                |
| `item_codes`             | SEC items or halt reason codes JSON                                                                                     |
| `timestamp`              | Event time (accept / halt / publish) — display as ET                                                                    |
| `impact_score`           | 0–100 hook (rules first)                                                                                                |
| `summary`                | Short blurb (rules / Groq later)                                                                                        |
| **New**                  | `event_kind` (`instant` \| `scheduled`), `urgency`, `session` (`pre` \| `rth` \| `ah`), industry via `companies.sector` |

### Score / filter hooks

1. **Rules v0:** category priority + halt always high + capital/distress boost + drop lone `9.01`.
2. **Playbook filters:** Halt, Capital, Deals, Earnings, Distress, Cyber.
3. **LLM v1 (later):** Groq `summary` + refine score for `8.01` / long EX-99 only.

### Cron / job matrix

| Job                     | Cadence (session)                | Persona | Notes               |
| ----------------------- | -------------------------------- | ------- | ------------------- |
| `fetch-sec-edgar` (8-K) | **15–60s** dedicated; GHA backup | P1      | Freshness SLA       |
| `fetch-nasdaq-halts`    | **60s** hard max                 | P1      | Nasdaq guideline    |
| `enrich-sec-body`       | Async queue; shared ≤~5–8 req/s  | P1      | New ids only        |
| `fetch-sec-offerings`   | **1–2 min**                      | P1/P2   | 424B / S-3 / 6-K    |
| `fetch-press-rss`       | **2–5 min**                      | P2      | Or paid if approved |
| `fetch-form4`           | **5 min** / watchlist            | P2/P4   | Volume control      |
| `fetch-openfda` / CT    | Hourly / daily                   | P3      |                     |
| `rebuild-calendar`      | Daily + on parse                 | P3      |                     |
| Retention               | End of successful P1 fetch       | P4      | Archive tier later  |

---

## 7. Phased delivery (Must / Should / Later)

### Phase A — MUST (approve to implement first)

1. **Reliable sub-minute SEC 8-K path** (dedicated cron; GHA = backup).
2. **Nasdaq Halt/Resume ingest** → Source `Nasdaq Halts`, category `halt`, amber badges.
3. **Item 1.05** + stronger noise rules.
4. **UX clarity:** Sector = industry (or temporary “Event” label); session clock ET; blotter density rules in §4.
5. **Schema hooks:** `urgency` / `event_kind` + halt reason in `item_codes`.

### Phase B — SHOULD

6. Async **EX-99 / body headline** enrichment.
7. Additional SEC Atom: _*6-K, 424B*, S-3_* + capital tags.
8. Populate **industry sector**.
9. Rule-based **`impact_score`**.
10. Optional **press RSS** or paid wire budget decision.

### Phase C — LATER

11. Form 4 (watchlist-scoped).
12. DIY + optional paid **FDA calendar**; openFDA + ClinicalTrials.
13. Calendar UI; watchlists; alerts; longer retention; public API.
14. Groq summaries for ambiguous `8.01` / long exhibits.

---

## 8. Schema / field additions (proposal)

| Table                                    | Addition                        | Why                          |
| ---------------------------------------- | ------------------------------- | ---------------------------- |
| `catalysts`                              | `urgency`                       | Halt vs routine sort / badge |
| `catalysts`                              | `event_kind`                    | Live vs calendar             |
| `catalysts`                              | `session`                       | PRE / RTH / AH chrome        |
| `item_codes` JSON                        | Halt reason codes (`T1`,`T3`,…) | Same column, new semantics   |
| `companies.sector`                       | Populate via job                | Honest Sector column         |
| **New** `calendar_events` (C)            | Forward events                  | PDUFA / trials               |
| **New** `watchlists` / `alert_rules` (C) | User-scoped                     | P4 / monetization            |

---

## 9. Risks

| Risk                         | Mitigation                                               |
| ---------------------------- | -------------------------------------------------------- |
| SEC rate limit (10 r/s) + UA | Shared throttle; queue body fetches                      |
| GHA cron unreliability       | Dedicated runner for P1 SLA                              |
| Nasdaq Halt RSS ToS / 1-min  | Poll ≤1/min; attribute Source                            |
| Press wire ToS               | Link-out; paid license before full-text                  |
| Paid API cost                | Phase B gate; free RSS first                             |
| Noise flood                  | Playbook filters + scores before enabling feeds          |
| PDUFA accuracy               | Never claim official FDA calendar                        |
| 30-day retention vs P3/P4    | Archive tier later                                       |
| False “real-time” marketing  | Honest SLAs: halt ~1 min; Atom seconds if runner healthy |

---

## 10. Top 5 proposed changes (priority order)

1. **Session-hour dedicated SEC 8-K poll (15–60s)** — P1 freshness.
2. **Ingest Nasdaq Halt/Resume RSS** into the Live blotter with amber urgency chrome.
3. **Parse/enrich material content** (Item 1.05 + EX-99/body queue).
4. **Widen SEC forms for capital bombs** (6-K / 424B / S-3) with filters.
5. **Desk-grade display system** — industry Sector vs event badge; mono ET Time·date; session clock; density + flash; `impact_score` hooks.

---

## 11. Approval gate

**Awaiting your approval before implementation/deploy.**

Please confirm or adjust:

- [ ] Phase A scope (SEC runner + halts + 1.05 + Sector labeling + blotter display rules)
- [ ] Body/EX-99 enrichment in A vs B
- [ ] Press: free RSS only vs budget for paid wire
- [ ] FDA calendar: DIY only vs paid aggregator later
- [ ] Any rename of feed column “Sector” → “Event” short-term
- [ ] Adopt design tokens in §2 for the next Live feed UI pass

Once approved, implementation should land on a **feature branch from `dev`** with a PR **into `dev` only** — not `main`, and not deployed until you explicitly ask.

---

_Catalyst Intel — internal product proposal. Not a commitment to vendors or SLAs until signed off. Design language informed by cited desk/terminal sources; not an affiliation with Bloomberg, IBKR, or TradingView._
