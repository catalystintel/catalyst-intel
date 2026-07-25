# Catalyst Intel — Client Target, Architecture & Flow

**Product brief for founders** · July 2026  
**Status:** Research + product architecture (not a commit)  
**Companion PDF:** `Catalyst-Intel-Client-Architecture-and-Flow.pdf`

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Target audience & personas](#2-target-audience--personas)
3. [Client needs / JTBD / pain points](#3-client-needs--jtbd--pain-points)
4. [Research insights](#4-research-insights)
5. [Product principles](#5-product-principles)
6. [Feature & service backlog](#6-feature--service-backlog)
7. [Architecture & flow](#7-architecture--flow)
8. [Recommended IA / key screens](#8-recommended-ia--key-screens)
9. [Success metrics](#9-success-metrics)
10. [Phased roadmap](#10-phased-roadmap)

---

## 1. Executive summary

**Catalyst Intel is a real-time catalyst triage desk for traders who trade the _why_, not the chart alone.**

Primary wedge: **SEC filings (especially 8-K / material events)** ingested, normalized, scored, and surfaced in a dense trading-desk feed before the story becomes “Yahoo Finance consensus.” FDA / clinical catalysts are a planned second source family — not the launch identity.

**Who pays:** Active event-driven and news/catalyst day traders, plus swing traders who size around known catalysts. **Who does not:** casual retail quote-checkers and Bloomberg-replacement buyers.

**Why we win (if we execute):**

- **Speed + structure** over raw EDGAR or headline spam
- **Trust** via Source | Sector | Title | Time·date, deep-links to original filings, and transparent scores
- **Triage**, not a second Bloomberg — impact scoring, filters, watchlists, alerts
- **Narrow excellence** (SEC → FDA later) vs Benzinga’s news firehose, Trade Ideas’ technical scanners, Unusual Whales’ options flow

**Already in repo (POC):** Next.js + Turso + Supabase auth; SEC EDGAR ingest; live-polling dashboard with Source/Sector/Title/time columns; admin fetch; retention. **Not yet:** AI scoring, alerts, watchlists, push, FDA.

---

## 2. Target audience & personas

### Primary (build for these)

| Persona                             | Profile                                                                                                         | Core job                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **P1 — Catalyst day trader**        | Trades opening range / AH gaps / halt resumes driven by filings & headlines. Screens open 6:00–16:00 ET.        | See material events in seconds; decide long/short/skip before the crowd. |
| **P2 — Event-driven / news trader** | Explicitly waits for catalysts (offerings, M&A, guidance, investigations). Often pairs with charting + Level 2. | Filter noise; keep only event types + symbols that match their playbook. |

### Secondary (serve without diluting)

| Persona                            | Profile                                                             | Core job                                                                    |
| ---------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **S1 — Catalyst swing trader**     | Holds days–weeks around filings, earnings aftermath, biotech PDUFA. | Calendar + scored events + post-event context; less need for sub-second UX. |
| **S2 — Solo analyst / small prop** | Builds watchlists, wants audit trail and exportable history.        | Reliable ingest, searchable archive, API later.                             |

### Non-goals (explicitly do not optimize for)

| Anti-persona                          | Why exclude                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| **Yahoo Finance / Robinhood casuals** | Want headlines & charts, not filing triage. Low willingness to pay for speed.          |
| **Pure technical day traders**        | Need scanners (Trade Ideas), not EDGAR intelligence.                                   |
| **Institutional Bloomberg seats**     | Need multi-asset depth, chat, execution, compliance stack. Wrong price & sales motion. |
| **Options-flow-only traders**         | Unusual Whales owns that wedge; we may _complement_ later, not replace.                |

### Segment decision (decisive)

**Beachhead = P1 + P2 (US equities, catalyst/news traders).**  
Positioning language: _trading desk_, not _AI SaaS_. Dense feed, keyboard-first, trust signals over marketing chrome.

---

## 3. Client needs / JTBD / pain points

### Jobs-to-be-done

1. **When** a filing or material event hits, **I want** to know symbol + event type + materiality **in seconds**, **so I can** act or dismiss before liquidity thins.
2. **When** my watchlist is quiet, **I want** only high-impact / playbook-matching catalysts, **so I** don’t drown in 8-K noise.
3. **When** I see a headline, **I want** one-click proof (EDGAR accession / primary source), **so I** don’t trade rumors.
4. **When** I’m away from the desk, **I want** push/email/webhook on _my_ rules, **so I** don’t miss AH/PM bombs.
5. **When** I size a trade, **I want** historical reaction context for similar events (later), **so I** calibrate risk.

### Pain points (today’s stack)

| Pain                          | Today’s workaround                | Gap                                                  |
| ----------------------------- | --------------------------------- | ---------------------------------------------------- |
| EDGAR is raw & slow to parse  | Manual EDGAR / free RSS / Twitter | No triage, no scoring, ugly UX                       |
| News firehoses                | Benzinga Pro, Twitter             | Speed yes; structure & filing depth uneven           |
| Technical scanners miss “why” | Trade Ideas                       | Great for price/volume; weak on disclosure semantics |
| FDA calendars siloed          | BioPharmCatalyst, UW FDA tab      | Not unified with SEC live desk                       |
| Trust / latency anxiety       | Cross-check 3 tabs                | No single Source·Time provenance UI                  |
| Alert fatigue                 | Email digests, Discord bots       | Bad rules → mute everything                          |

### Must-satisfy outcomes

- Latency from public disclosure → visible row: **target &lt; 30–60s** (POC honesty: cron + poll today; tighten via scheduler + push later)
- Every row: **Source | Sector | Title | Time·date** + symbol + deep link
- Filters that match trader playbooks (form type, item codes, sector, market cap, watchlist)
- Scores that are **explainable** (why impact = High)
- Legal clarity: intelligence tool, not advice; attribution to SEC/FDA sources

---

## 4. Research insights

### Market & user takeaways

1. **Catalyst traders buy time and triage**, not more news volume. Competitors that win mindshare compress _detect → understand → act_.
2. **Event-driven platforms** (LevelFields, FinMonkeys Catalyst Radar, NewsMAV-class tools) validate demand for **impact scoring + historical reaction** on corporate events — adjacent category, not identical UX.
3. **Day traders** need sub-minute awareness during RTH/AH; **swing traders** need calendars + ranked queues. One product can serve both if the **feed is primary** and calendar is secondary.
4. **Casual retail** consolidates on free delayed news — poor fit for paid real-time SEC desk.
5. Latency of _scheduler_ is a product risk: unreliable crons destroy trust even if parsing is perfect. Self-healing fetch (already in architecture) is table stakes; dedicated cron / queue is the real fix.

### Competitive gaps (actionable)

| Player                                         | Strength                               | Gap vs Catalyst Intel opportunity                                    |
| ---------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| **EDGAR (raw)**                                | Authoritative, free                    | No UX, no scoring, no alerts, no watchlists                          |
| **Benzinga Pro**                               | News speed, audio squawk, retail brand | Firehose; filing structure secondary; expensive “news terminal” feel |
| **Bloomberg**                                  | Institutional depth                    | Overkill / unattainable for target; not filing-triage-first          |
| **Trade Ideas**                                | Technical AI scanners                  | Price/volume events ≠ disclosure intelligence                        |
| **Unusual Whales**                             | Options flow + FDA calendar            | Flow-first; SEC semantic triage not the core product                 |
| **FDA calendars** (UW, BioPharmCatalyst, etc.) | Biotech known-date catalysts           | Forward calendar ≠ real-time 8-K desk; siloed                        |
| **Emerging AI catalyst tools**                 | Scoring + summaries                    | Often generic “AI SaaS”; trust/provenance UX weak; crowded claims    |

### Positioning wedge

> **The fastest trustworthy SEC catalyst desk for active traders — structured like a blotter, not a blog — with FDA/clinical as the next tape.**

Do not claim “faster than Benzinga wire” without measurement. Claim **structured filing intelligence + provenance + playbook filters** that news apps under-deliver.

---

## 5. Product principles (UX/UI for this audience)

1. **Blotter density** — Rows over cards. First viewport = live tape. No marketing hero inside the app.
2. **Provenance first** — Every event shows Source, timestamp (ET), and link to primary document.
3. **Column grammar** — `Source | Sector | Title | Time·date` (+ symbol, score). Scannable in &lt;200ms per row.
4. **Speed is a feature** — Visible “as of” / live indicator; stale data must scream, not whisper.
5. **Explainable AI** — Scores show reasons (e.g., Item 2.01, offering size, halt). No black-box oracles.
6. **Playbook filters** — Save filter presets (“Offerings only”, “Biotech 8-K”, “Watchlist High”).
7. **Keyboard & alert dual path** — Desk users stay in feed; mobile is alert + deep link back.
8. **Trading-desk visual language** — Charcoal / ink / muted green & amber status — not purple SaaS gradients.
9. **Trust & legal** — “Not investment advice”; show source system; rate limits & fair use.
10. **One job per screen** — Feed = triage. Detail = understand. Alerts = rules. Admin = ops.

---

## 6. Feature & service backlog

Mapped to needs. Priority: **Must / Should / Later**.

### Must (POC → paid beta)

| ID  | Feature / service                                                         | Need served  |
| --- | ------------------------------------------------------------------------- | ------------ |
| M1  | Reliable SEC EDGAR ingest (8-K focus) + dedupe by accession               | JTBD 1       |
| M2  | Live catalyst feed (poll → SSE/WS later) with Source\|Sector\|Title\|Time | JTBD 1, 3    |
| M3  | Symbol resolution, sector, form/type, Item codes (8-K)                    | JTBD 2       |
| M4  | Detail drawer: summary fields, raw link, company meta                     | JTBD 3       |
| M5  | Filters: symbol, sector, form, category, time range                       | JTBD 2       |
| M6  | Auth + basic account; admin trigger & freshness monitor                   | Ops / trust  |
| M7  | Retention + rate limits + legal disclaimer                                | Trust / cost |
| M8  | Impact score v1 (rules + light LLM) with reasons                          | JTBD 1, 2    |

### Should (next)

| ID  | Feature / service                                                         | Need served |
| --- | ------------------------------------------------------------------------- | ----------- |
| S1  | Watchlists + watchlist-only feed mode                                     | JTBD 2, 4   |
| S2  | Alert rules → email / webhook / browser push                              | JTBD 4      |
| S3  | Saved playbook presets & default sorts (score, time)                      | JTBD 2      |
| S4  | Ingest SLA dashboard (lag p50/p95, cron health)                           | Trust       |
| S5  | Search & 30–90d archive beyond retention window (tiered)                  | S2 analyst  |
| S6  | Market-cap / exchange filters; halt tagging if available                  | JTBD 1      |
| S7  | Faster scheduler (Vercel cron / queue worker) + optional push of new rows | Speed       |

### Later

| ID  | Feature / service                                              | Need served   |
| --- | -------------------------------------------------------------- | ------------- |
| L1  | FDA / ClinicalTrials.gov / PDUFA calendar merge into same tape | Biotech swing |
| L2  | Historical post-event returns (1D/5D) by event class           | JTBD 5        |
| L3  | Multi-source PR wires (careful dedupe vs SEC)                  | Coverage      |
| L4  | Mobile-optimized alert app / PWA                               | JTBD 4        |
| L5  | Public API / webhooks for prop desks                           | S2            |
| L6  | Options-flow confluence (partner or light UW-like)             | Adjacent      |
| L7  | Team seats, audit logs, SSO                                    | Small firm    |

### Services / platform (cross-cutting)

- **Ingestion workers** (per source), **scoring service**, **alert dispatcher**, **auth**, **analytics (PostHog)**, **admin ops**, **compliance copy**, **billing** (later).

---

## 7. Architecture & flow

### 7.1 Current (as built)

```
GitHub Actions / local cron
        │
        ▼
POST /api/admin/fetch/sec-edgar ──► fetchSecEdgar() ──► SEC EDGAR Atom
        │                                    │
        │                                    ▼
        │                              libSQL / Turso
        │                                    ▲
Browser ──poll──► GET /api/catalysts ─────────┘
   │                    │
   │                    └── if stale: self-heal refetch
   ▼
Dashboard feed + detail drawer
Supabase Google OAuth gates access
```

### 7.2 Target logical architecture

```
┌─────────────┐   ┌──────────────┐   ┌─────────────┐
│ SEC EDGAR   │   │ FDA / CT.gov │   │ (future PR) │
└──────┬──────┘   └──────┬───────┘   └──────┬──────┘
       │                 │                  │
       ▼                 ▼                  ▼
┌──────────────────────────────────────────────────┐
│              Ingestion layer                     │
│  fetch · normalize · dedupe · symbol resolve     │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│           Catalyst store (Turso/libSQL)          │
└───────┬──────────────────────────────┬───────────┘
        ▼                              ▼
┌───────────────┐              ┌───────────────┐
│ Scoring svc   │              │ Alert rules   │
│ rules + LLM   │              │ dispatcher    │
└───────┬───────┘              └───────┬───────┘
        ▼                              ▼
┌──────────────────────────────────────────────────┐
│  API: feed · detail · watchlists · alerts · admin│
└──────────────────────┬───────────────────────────┘
                       ▼
              Trading desk UI + push channels
```

### 7.3 User flow (triage)

```
Sign in → Live Feed
    → Scan columns (Source|Sector|Title|Time)
    → Filter / Watchlist
    → Open detail (proof + score reasons)
    → Act in broker (external) OR dismiss
    → (Optional) Save alert rule from this event type
```

### 7.4 Alert flow

```
New catalyst written
  → Evaluate user rules (symbol/sector/score/form)
  → Deduplicate / rate-limit
  → Deliver email | webhook | push
  → Deep link → detail
```

---

## 8. Recommended IA / key screens

| Route / area                              | Purpose            | Primary elements                                                   |
| ----------------------------------------- | ------------------ | ------------------------------------------------------------------ |
| **`/dashboard` (Live Feed)**              | Triage blotter     | Live status, filters, dense table, score, relative + absolute time |
| **Catalyst detail** (drawer or `/c/[id]`) | Proof & understand | Headline, items, score reasons, EDGAR link, company                |
| **Watchlists**                            | Playbook focus     | CRUD lists; feed toggle “Watchlist only”                           |
| **Alerts**                                | Away-from-desk     | Rule builder; delivery channels; quiet hours                       |
| **Archive / Search**                      | Post-hoc research  | Query by symbol/accession/date                                     |
| **Profile**                               | Account            | Name, prefs (timezone ET default), disclaimer ack                  |
| **Admin**                                 | Ops                | Manual fetch, freshness, ingest errors, retention                  |
| **Login**                                 | Gate               | Google OAuth only (current)                                        |

**Nav priority:** Feed → Watchlists → Alerts → Archive → Admin (if role).

---

## 9. Success metrics

### Product / UX

| Metric                                  | Target (directional)    |
| --------------------------------------- | ----------------------- |
| Time-to-first-meaningful-row (session)  | &lt; 3s                 |
| % sessions with filter or watchlist use | &gt; 40% within 2 weeks |
| Detail open rate on High-score rows     | &gt; 25%                |
| Alert → click-through (if shipped)      | &gt; 15%                |
| “Stale feed” incidents / week           | → 0 in paid beta        |

### Data / pipeline

| Metric                                 | Target                                   |
| -------------------------------------- | ---------------------------------------- |
| Ingest lag p50 / p95 (disclosure → DB) | &lt; 30s / &lt; 90s (post-scheduler fix) |
| Dedupe accuracy (accession)            | 100%                                     |
| Symbol resolve rate on 8-K             | &gt; 95%                                 |

### Business (early)

| Metric                        | Signal                                 |
| ----------------------------- | -------------------------------------- |
| Waitlist → activated trader   | Qualitative interviews + weekly active |
| D7 retention (active traders) | &gt; 25%                               |
| Willingness to pay interview  | ≥ 5/10 target personas say “yes at $X” |

**North star (founders):** _High-score catalysts seen and acted on before secondary news aggregation_ — measured via lag vs public EDGAR timestamp + qualitative trader diaries.

---

## 10. Phased roadmap

### Phase 0 — POC (now / shipping)

- SEC 8-K ingest, dedupe, dashboard feed columns, auth, admin fetch, retention, self-heal.
- **Outcome:** Demo-able desk; prove column grammar & data path.

### Phase 1 — “Trustworthy tape”

- Scoring v1 + reasons; stronger filters; freshness SLA UI; scheduler reliability; playbook presets.
- **Outcome:** Traders trust the tape enough for daily use.

### Phase 2 — “My desk”

- Watchlists, alerts (email/webhook/push), archive search, billing-ready accounts.
- **Outcome:** Paid beta for P1/P2.

### Phase 3 — “Multi-catalyst”

- FDA / clinical calendar + live biotech events on same IA; historical reaction stats; API.
- **Outcome:** Expand to S1 biotech swings without losing SEC identity.

### Phase 4 — Later bets

- PR wires, flow confluence, team/SSO, mobile PWA polish.

---

## Appendix A — Repo alignment (snapshot)

| Built                                           | Planned                         |
| ----------------------------------------------- | ------------------------------- |
| Next.js app, Turso/libSQL, Supabase Google auth | LLM scoring (Groq/Qwen planned) |
| `fetchSecEdgar`, 8-K item parse, symbol lookup  | Watchlists, alerts, FDA ingest  |
| Live poll feed, detail drawer, admin            | SSE/WS, billing, API            |
| PostHog optional                                | Historical reaction analytics   |

## Appendix B — Tone & brand notes

- Name always **Catalyst Intel**.
- UI: desk blotter, muted status colors, monospace for times/symbols where helpful.
- Avoid purple gradient “AI platform” aesthetics; avoid cream/terracotta editorial look.
- Copy: short, operational (“Live”, “Stale”, “High impact”, “Source: SEC EDGAR”).

---

_Document generated for sharing — July 2026. Not committed to the repository._
