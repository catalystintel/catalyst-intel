# Engineer UX / UI Implementation Guide

**Audience:** Software engineers changing the Catalyst Intel web app  
**Purpose:** One clear file that says who the user is, what the desk must do, and exactly how to build / change UX and UI  
**Status:** Synthesis of research + current code (Jul 2026) — not a new product invent  
**Easy read (PDF-style):** [`ENGINEER-UX-UI-GUIDE-SIMPLE.md`](./ENGINEER-UX-UI-GUIDE-SIMPLE.md)  
**Companion roadmaps:** [`ENGINEER-UX-FEATURE-ROADMAP.md`](./ENGINEER-UX-FEATURE-ROADMAP.md), [`ENGINEER-UX-FEATURE-ROADMAP-VISUAL.md`](./ENGINEER-UX-FEATURE-ROADMAP-VISUAL.md)  
**QA:** repo root [`ACCEPTANCE-JTBD.md`](../../ACCEPTANCE-JTBD.md)

Use this file when you edit feed, article, watchlist, alerts, fonts, colors, or empty states. Prefer short “Do X” rules over debate. For a lighter first pass, start with the [simple guide](./ENGINEER-UX-UI-GUIDE-SIMPLE.md).

`CATALYST-NEWS-CONVERSATION-SUBJECTS.md` was not in the repo at write time; substance below comes from the Client Target / JTBD / Benzinga / Architecture docs instead.

---

## How to use this guide

1. Read **§1 Who + JTBD** before any UI change.
2. Treat **§2–§12** as the build contract for each surface.
3. Check **§13 What NOT to build** before adding chrome.
4. Execute **§14 Checklist** in order when shipping UX work.
5. Cite source filenames if a PR needs more depth.

---

## 1. Who the user is (client target) and what job they need

### Beachhead clients (build for these first)

| Persona                                  | Who                                                             | What they need on screen                                                       |
| ---------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **A — Marcus** (catalyst day trader)     | Full-time / serious part-time US equities; gaps, AH, first hour | Fast EDGAR triage, clear event type, one-screen context, Quiet mode after open |
| **B — Priya** (event-driven specialist)  | Filings, FDA/calendar, M&A with confirmation                    | Accurate event labels (esp. 8-K items), proof links, category filters          |
| **C — Elena** (active swing around news) | Holds hours–days around material events                         | High-signal watchlist alerts, less midday noise, clear lean + caution          |

Sources: `Catalyst-Intel-Client-Target-Guideline.md`, `Catalyst-Intel-Client-Summary.md`, `Catalyst-Intel-Client-Architecture-and-Flow.md`.

### Primary JTBD (product contract)

> When a filing or market-moving event hits, understand **what it is**, **why it matters**, and **whether it fits my playbook** in seconds — then **Act or Dismiss** with confidence.

Job chain:

1. **Detect** material catalysts at primary sources
2. **Classify** (category / 8-K item / halt / FDA / etc.)
3. **Score** materiality (explainable)
4. **Contextualize** (WIIM, summary, lean when available)
5. **Decide** Act vs Dismiss
6. **Monitor** watchlist / Quiet playbook
7. **Learn** which types they trade well (later)

Sources: `Catalyst-Intel-JTBD-UX-UI.md`, `ACCEPTANCE-JTBD.md`, Client Target §2–3.

### Positioning (protect this)

- This is a **decision / triage desk** for **event** traders.
- Order of truth: **Source > story > score > suggestion**.
- Do claim: clearer decisions, source proof, less noise.
- Do **not** claim: faster than Benzinga wire, Bloomberg killer, guaranteed edge, “verified AI” without source UX.

### Explicit non-targets

Passive research terminals · pure options-flow · pure technical scanners · Bloomberg replacement · crypto-first / everything-news.

---

## 2. Product principles (desk, not SaaS blog)

From `Catalyst-Intel-Client-Architecture-and-Flow.md` §5 and Client Target Guideline:

| Principle                  | Engineer rule                                                                  |
| -------------------------- | ------------------------------------------------------------------------------ |
| Blotter density            | Rows over cards. First viewport = live tape. No marketing hero inside the app. |
| Provenance first           | Show source name, ET event time, and primary document link.                    |
| Explainable scores         | Always show “Why this score?” next to materiality.                             |
| Quiet / playbook           | First-class noise control — not a buried setting.                              |
| Keyboard + alert dual path | Desktop = feed triage; mobile = alerts + deep link back.                       |
| Desk visual language       | B&W mono desk + amber live accents. Not purple SaaS.                           |
| One job per screen         | Feed = triage. Article = understand. Alerts = rules. Admin = ops.              |

---

## 3. Overall desk layout / first screen

### IA / nav order

**Feed → Watchlists → Alerts → Archive → Admin**

| Route                      | Job               | Primary UI                                       |
| -------------------------- | ----------------- | ------------------------------------------------ |
| `/dashboard`               | Live triage       | Soft-poll tape (`live-catalyst-feed.tsx`)        |
| `/dashboard/catalyst/[id]` | In-app Read       | Article view (`catalyst-article-view.tsx`)       |
| `/watchlist`               | Quiet playbook    | Symbols + category chips                         |
| `/alerts`                  | Away desk         | Webhook / email rules (push stub)                |
| Archive / Search           | Post-hoc research | **Gap** — Phase 2 in roadmap                     |
| `/admin`                   | Ops only          | Fetch SEC EDGAR, ingest health (allowlisted)     |
| `/analytics`               | Desk stats        | Secondary; do not steal first viewport from feed |
| `/profile`                 | Account           | Prefs only                                       |

Sources: Architecture §8, `Catalyst-Intel-JTBD-UX-UI.md`, `ENGINEER-UX-FEATURE-ROADMAP.md`.

### First screen rules (`/dashboard`)

1. Put the **live tape** in the first viewport after sign-in.
2. Show panel title **Latest News** (or equivalent desk label).
3. Soft-poll `/api/catalysts` (~20s focused, slower when blurred; pause when tab hidden).
4. Show **Last updated** + manual refresh. Never fake “instant wire.”
5. Flash new rows briefly (`row-flash`). Offer a “N new” jump-to-top control when scrolled.
6. Keep chrome thin: filters + Quiet toggle + freshness. No hero, no promo strip, no card grid of stats above the blotter.
7. Optional split panel (chart/quote) must stay secondary to the tape — tape remains the decision surface.
8. **Symbol click** opens drawer/split with chart, multi-timeframe quote, and correlated symbol news (Visual §1A-C).

### Pre-login / marketing (`/`)

- No authenticated dashboard chrome and **no demo live tape / keys strip**.
- Emphasize real-time news catalysts: efficient, filtered, broad topic coverage.
- Hero: brand + one headline + one supporting sentence + CTA. See Visual §1A-E.

### Shell rules

- Use the authenticated desk shell (`AppShell` + sidebar).
- Brand mark + “Catalyst Intel” in sidebar is fine; do not overpower the tape with marketing copy.
- Disable or hide “coming soon” nav that distracts from Feed / Watchlist / Alerts.

---

## 4. Feed table / list (columns, density, filters, sort)

### Product decision (Jul 2026 JTBD) — implement against this

**Decision:** default blotter columns are **Symbol · Title · Time** (Symbol first as row index; not Title · Time · Event · Symbol).  
Keep the **Action** toolbar (Read · Dismiss · Quiet). Full acceptance + provider gaps: [`ENGINEER-UX-FEATURE-ROADMAP-VISUAL.md`](./ENGINEER-UX-FEATURE-ROADMAP-VISUAL.md) §1A.

Live blotter columns on desktop (`live-catalyst-feed.tsx`):

| Column     | Content                                            | Rules                                                                                                                              |
| ---------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Symbol** | Symbol or `—`                                      | Leading index column. Mono, semibold. Clickable when present → drawer / split (§4C).                                               |
| **Title**  | Headline preferred, else filing title              | Truncate on desktop; 2-line clamp on mobile. **No** source/provider under the title; strip provider prefixes (`stripSourceNames`). |
| **Time**   | Event occurrence in **ET** (`catalysts.timestamp`) | Use `formatTimeDate` / `formatClockTime`. **Never** show DB insert time as event time. `tabular-nums`.                             |
| **Action** | Hover / focus toolbar                              | Read · Dismiss · Quiet. Own column so buttons never overlap Time.                                                                  |

**Removed from primary columns (decision):** Event chip column; Source column / source strip under title.  
Event/category remain on **filter chips** and inside Read / drawer meta — not on the default blotter.

Grid comment in code: Impact column is **intentionally hidden for now**. Do not re-add Impact/Sector/Proof/Event as primary columns unless product reopens that decision.

Mobile: Symbol index col + Title; **Time** under Title; always-visible action buttons (no hover-only).

### Earnings filter — alternate column schema

When the **Earnings** filter is active, replace default columns with:

**Date · Name · Symbol · Period · EPS · Estimation**

- **Period** = fiscal quarter only (`Q1` / `Q2` / `Q3` / `Q4`).
- EPS / Estimation may be `—` when unknown; never invent numbers.
- Prefer Finnhub earnings calendar / surprises + SEC 8-K Item 2.02. See Visual roadmap §1A-B for schema notes.

### Symbol click → drawer / split

Clicking **Symbol** opens `catalyst-detail-drawer.tsx` or `tape-split-panel.tsx` (tape stays primary) with:

1. Price chart for that symbol
2. Quote + change across available timeframes
3. Correlated news/catalysts for that symbol (keyword / symbol join) → in-app Read

Honest empty states when market APIs are unkeyed.

### Density

- Target ~56px min row height on desktop.
- Sticky uppercase mono column headers.
- One row = one catalyst. No nested cards inside the tape.
- Hover: soft overlay + thin left amber inset. Selected row: stronger overlay.
- Do **not** show source under the title on the dashboard.

### Filters (do keep)

| Control                 | Behavior                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| Symbol / company search | Filter visible tape                                                                               |
| Time window             | **1h / 4h / 24h / All**                                                                           |
| Primary category chips  | **All → Earnings → FDA Approvals → Clinical Trials → IPO → Gov Reports** (UX order; Visual §1A-D) |
| Quiet playbook toggle   | Persists via `/api/playbook`; filters by watchlist + playbook categories                          |

Wire each primary chip to real ingest (openFDA, ClinicalTrials.gov, Finnhub earnings/IPO, SEC/macro for Gov Reports). Hide or gate chips that have no provider yet — do not ship empty forever filters. Provider map: Visual roadmap §1A.

### Sort

- Default: **newest event time first** (descending `timestamp`).
- Do not invent a second default sort that hides fresh High-impact rows without an explicit user control.
- When you add score sort later, keep time as the honest primary for “what just hit.”

### Older research column models (superseded)

Research / older shipped grammar also mentioned:

- Mental model: `Source \| Sector \| Title \| Time·date` (Client Target)
- Earlier JTBD preview: `Symbol/Event · Sector · Impact · Title · Proof · Time`
- Prior implementation guide: **Title · Time · Event · Symbol · Action**

Those are **historical**. **Current product grammar is Symbol · Title · Time (+ Action)**; Earnings filter uses the alternate schema above. If you change columns again, update this guide, the [simple guide](./ENGINEER-UX-UI-GUIDE-SIMPLE.md), Visual §1A, and `Catalyst-Intel-JTBD-UX-UI.md` in the same PR.

Sources: `live-catalyst-feed.tsx`, Visual roadmap §1A, `Catalyst-Intel-JTBD-UX-UI.md`, Client Target §7.1, Architecture §5.

---

## 5. Catalyst event types — how they appear and labels

### Category keys (single source of truth)

Use `src/lib/catalysts/taxonomy.ts` → `CATEGORY_LABELS`. Do not invent parallel label maps in components.

| Key             | UI label            | Typical sources / meaning                  |
| --------------- | ------------------- | ------------------------------------------ |
| `earnings`      | Earnings            | 8-K 2.02, earnings calendars               |
| `deals`         | M&A / Deals         | 8-K 1.01 / 2.01 style M&A, contracts       |
| `management`    | Management          | Officer/director changes (e.g. 5.02)       |
| `capital`       | Capital / Financing | Offerings, S-3 / 424B-class capital        |
| `distress`      | Distress            | Going-concern / distress signals           |
| `restructuring` | Restructuring       | Reorg / restructuring                      |
| `governance`    | Governance          | Governance / shareholder items             |
| `disclosure`    | Disclosure          | Broad / other disclosure                   |
| `trading_halt`  | Trading Halt        | Nasdaq halt / resume                       |
| `insider`       | Insider             | Form 4 / insider                           |
| `regulatory`    | Regulatory / FDA    | openFDA, regulatory 8-K                    |
| `clinical`      | Clinical            | ClinicalTrials.gov                         |
| `macro`         | Economics / Macro   | CPI / NFP / FOMC schedule (and later FRED) |
| `analyst`       | Analyst Actions     | Finnhub rec / PT (partial)                 |
| `cyber`         | Cybersecurity       | Cyber incidents                            |
| `news`          | News                | Wire / Polygon Benzinga-labeled news       |
| `other`         | Other               | Fallback                                   |

### Event cell display rules

1. Prefer **subcategory** text (underscores → spaces), e.g. `halt resumed`, `8-K item 2.02`.
2. Else use raw **type** (e.g. `8-K`, form codes).
3. Else use **category label** from `CATEGORY_LABELS`.
4. Else show `—`.
5. Keep filter chips on **category**; keep Event cell on **specific** label when you have it.

Implementation: `eventLabel()` in `src/lib/catalysts/feed-display.ts`.

### High-value 8-K item focus (Priya)

Harden mapping and visible labels for items traders care about first: **1.01, 2.02, 5.02, 7.01, 8.01**.  
Show item codes in Event / drawer / article meta when known. Do not bury them only in tags.

### Halts

- Pair halt and resume when data allows.
- Label clearly (`Trading Halt` category; subcategory for resume).
- Never look like a normal “News” row.

### FDA / Clinical / Form 4 / Macro

- Same default blotter columns as SEC (**Symbol · Title · Time**) — do not invent a second UI grammar except the **Earnings** alternate schema (Visual §1A-B).
- Always keep a **Proof / original source** path (article secondary CTA / drawer) — not as a dashboard Source column.
- Macro schedule rows must show event time honesty (scheduled vs print).

### Source labels (article / drawer — not dashboard rows)

Be honest about provider on **Read / drawer / proof**, not on the feed row:

- SEC EDGAR, Nasdaq Halts, Finnhub, Polygon / **Benzinga Wire** (when keyed), openFDA, ClinicalTrials, Form4API, etc.
- DIY packs ≠ redistribute Benzinga wholesale — license honesty in UI copy.
- Dashboard rows: strip source names from titles; no provider strip under Title.

Sources: `taxonomy.ts`, Benzinga source map, Client Summary taxonomy notes, Client Target App B.

---

## 6. Row hover actions (Read / Act / Dismiss / Quiet)

### What each button does

| Action      | Desktop             | Behavior                                                                         | Must / must not                                                 |
| ----------- | ------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Read**    | Hover toolbar (lg+) | Opens **in-app article** `/dashboard/catalyst/[id]`                              | Primary deep-read path. Amber / primary variant OK.             |
| **Act**     | Hover toolbar       | Opens / focuses **detail drawer** for quick triage                               | Does **not** mutate DB. Keyboard: row Enter/Space also selects. |
| **Dismiss** | Hover toolbar       | Hides row in this browser (`localStorage` `ci.dismissed-catalyst-ids`, last 200) | Does **not** delete the DB row. Animate out (`row-dismiss`).    |
| **Quiet**   | Hover toolbar       | Adds symbol to quiet watchlist                                                   | Disabled if already on watchlist. No symbol → hide button.      |

### Interaction rules

1. Desktop: actions live in the **Action** column; opacity 0 until `group-hover` / `focus-within` / selected.
2. Mobile / < lg: actions always visible under the stacked meta — never hover-only.
3. Stop click propagation on action buttons so they do not re-trigger row select incorrectly.
4. Title click / Read → article. Proof / original source → **new tab** (does not replace in-app reader).
5. Prefetch article on row hover/focus when cheap.

### Quiet playbook (related)

- Header toggle **Quiet playbook** persists via playbook API.
- Quiet on + watchlist non-empty → only watchlist symbols whose category is in playbook.
- Quiet on + empty watchlist → playbook categories only.
- Quiet off → normal filters only.
- Empty quiet copy: _“Quiet playbook: no watchlist/playbook matches right now.”_

Sources: `ACCEPTANCE-JTBD.md` JTBD 1–3, `Catalyst-Intel-JTBD-UX-UI.md`, `live-catalyst-feed.tsx`.

---

## 7. Article / detail page (WIIM, summary, enrichment)

Route: `/dashboard/catalyst/[id]` · Component: `catalyst-article-view.tsx`  
Sources: `Catalyst-Intel-Internal-Article-View.md`, `Catalyst-Intel-Benzinga-Like-Article-Display.md`.

### Layout order (Do this)

```
← Live tape                          In-app article
──────────────────────────────────────────────────
SYMBOL   [related chips…]     Category · Materiality
Headline
Company

┌ WHY IT'S MOVING · one sentence ─────────────────┐
└─────────────────────────────────────────────────┘

Provider · Category · Type · Time          [Original source]
(optional thumb)     Δ since publish (if quote exists)

SUMMARY
• bullet
• bullet
• bullet

DETAIL (key/value cards: EPS, rev, guidance, items…)

ARTICLE BODY (Beats/Misses highlights when relevant)

Filing items · Tags
```

### Concrete rules

1. **Back link** to Live tape at top.
2. **Symbol-first** header (large mono). Related symbols as secondary chips when data exists.
3. **WIIM strip** (`whyMoving`): one bordered line above summary — highest triage upgrade (P0).
4. **Takeaways**: prefer 3 short bullets over essay prose (P0). Fallback to short paragraph if bullets empty.
5. **Summary source**: prefer stored `catalysts.summary`; else extractive from body; never invent numbers.
6. **Original source** is a **secondary** CTA (new tab). In-app Read is primary.
7. **No iframe** of arbitrary news sites. If no stored body, show title/summary + point to original.
8. **Detail cards** for earnings / structured fields when available.
9. **Semantic highlights** for Beats/Misses and key catalyst verbs — accent tokens only, not full-row green/red chrome.
10. **Enrichment** (profile / related / quote) soft-fails; never block the page.
11. **Historical reaction**: placeholder only until real analogs ship — **no fake numbers** (`ACCEPTANCE-JTBD.md` JTBD 5).
12. Drawer (Act path) repeats symbol, category, materiality, proof, filing items, and score reasons — same trust rules as article.

### Borrow vs do not borrow (Benzinga IA)

| Mirror                                       | Do not mirror                     |
| -------------------------------------------- | --------------------------------- |
| Symbol-first, WIIM one-liner, bullet summary | Loud green/red chrome everywhere  |
| Related symbol chips, density over imagery   | Squawk as v1 requirement          |
| Compact thumb + Δ (non-hero)                 | Magazine hero + overlay badges    |
| Quick open-source actions                    | Multi-panel workspace inside Read |

---

## 8. Typography (Inter body, Roboto headings, tabular nums)

**Current code (treat as shipped):** `src/app/layout.tsx` loads **Inter** + **Roboto** via `next/font/google`.  
`src/app/globals.css` wires:

- `--font-sans` → Inter (body / UI)
- `--font-heading` → Roboto (`h1`–`h6`)
- `--font-mono` → Inter with `font-variant-numeric: tabular-nums` for times, prices, symbols

If you are on an older deploy without this, note PR **#103** (Inter + Roboto desk fonts) and match that merge.

### Implement guidance

| Element                                       | Font / class                     | Notes                        |
| --------------------------------------------- | -------------------------------- | ---------------------------- |
| Body, buttons, filters, article prose         | `font-sans` (Inter)              | Default on `<body>`          |
| Page / section headings                       | `font-heading` (Roboto)          | Already applied to `h1`–`h6` |
| Symbols, times, scores, column headers, chips | `font-mono` + tabular nums       | Align digits in columns      |
| Feed title line                               | Sans medium, tight tracking      | Scannable, not display-serif |
| Do not                                        | System Inter/Roboto mix randomly | Keep tokens in `globals.css` |

### Do

1. Keep Inter for dense UI text — it reads clean at small sizes.
2. Keep Roboto for headings so hierarchy is obvious without size inflation.
3. Always use tabular nums for time and price columns.
4. Prefer mono for blotter meta (Event chips, Last updated, Proof labels).

### Do not

1. Do not switch the desk to decorative display fonts.
2. Do not use proportional digits in Time / Impact / price strips.
3. Do not restyle the whole app to “magazine” typography for articles.

---

## 9. Color / contrast for a trading desk

### Visual language

- **B&W mono desk** is the product look (light paper desk by default; dark charcoal desk optional).
- **Amber** (`--desk-live`, ~`#f0c14b` / muted gold on light) only for: LIVE pulse, High impact, primary Act/Read emphasis, selected inset.
- Steel / gray for secondary text and borders — not purple, not neon.

Tokens live under `--desk-*` in `globals.css` (light + `.dark`). Prefer these over inventing new brand colors.

Design-only reference: `Catalyst-Intel-JTBD-Visual-Preview-README.md` (charcoal / steel / amber).

### Contrast rules

1. Title text must stay high contrast on row hover (`--desk-text` / `--desk-text-secondary`).
2. Dim meta (`--desk-text-dim`) is for source/tags only — never for the headline.
3. Event chips: border + soft overlay; do not rainbow-code every category.
4. Semantic green/red **only** on market Δ / Beats-Misses words — not whole UI chrome.
5. Stale / error states must **scream** (clear banner), not whisper in dim gray.

### Do not invent

- Purple-on-white / indigo SaaS gradients
- Glow-heavy “AI” aesthetics
- Loud red/green terminal skins as the default theme

---

## 10. Mobile vs desktop

| Concern       | Desktop                          | Mobile                                                                 |
| ------------- | -------------------------------- | ---------------------------------------------------------------------- |
| Primary job   | Full blotter triage              | Alert path + readable article                                          |
| Feed columns  | Symbol · Title · Time (+ Action) | Mobile: Symbol index + Title; Time under Title; actions always visible |
| Hover actions | OK                               | Never rely on hover                                                    |
| Article       | Full WIIM + bullets + body       | Same stack, narrower; CTAs thumb-friendly                              |
| Alerts        | Configure rules                  | Receive + deep link to Read                                            |
| Nav           | Sidebar                          | Collapsed / sheet — keep Feed reachable in one tap                     |
| Viewport      | Dense rows                       | `viewportFit: cover`; avoid horizontal scroll on tape                  |

Rules:

1. Desktop is the primary desk.
2. Mobile must still complete JTBD 3 (open article + proof) and JTBD 4 (away alerts).
3. Do not ship a separate “mobile magazine” layout that drops Event labels or Proof.

Sources: Client Target §7.1 #10, Architecture principle 7, `ACCEPTANCE-JTBD.md`.

---

## 11. Empty / loading / error states

### Empty

| Case                  | Copy / UI                           | Action                               |
| --------------------- | ----------------------------------- | ------------------------------------ |
| No catalysts yet      | Honest empty — not a fake demo tape | Admins: point to **Fetch SEC EDGAR** |
| Filters match nothing | Clear “no matches”                  | Offer reset filters                  |
| Quiet matches nothing | Quiet-specific empty message        | Link to edit Watchlists              |

### Loading

1. Use desk-consistent skeletons (`loading.tsx` / `loading-skeleton.tsx`) — not purple spinners.
2. Soft-poll should not flash the whole table empty on every refresh.
3. Article enrichment may load after shell; show base article first.

### Error / degraded

| Case              | Do                                                                   |
| ----------------- | -------------------------------------------------------------------- |
| Feed fetch fail   | Show error + retry; keep last good rows when possible                |
| Stale ingest      | Banner that feed may be stale; never imply live wire if lagging      |
| Missing EDGAR URL | Show muted “No EDGAR link” / `—` — **do not hide** the Proof control |
| AI / summary down | Fall back to extractive / stored text; never silent wrong numbers    |
| Alert Test fail   | Per-channel ok/fail detail (e.g. missing `RESEND_API_KEY`)           |

Sources: Client Target §7.3 #21, Architecture S4/S7, Internal Article View.

---

## 12. Admin vs trader surfaces

| Surface                                       | Who                | Rules                                                           |
| --------------------------------------------- | ------------------ | --------------------------------------------------------------- |
| Feed / Watchlist / Alerts / Article / Profile | Traders            | Decision UX only. No ingest ops chrome in the tape.             |
| `/admin`                                      | Allowlisted admins | Fetch SEC EDGAR, Finnhub NYSE, migrate, ingest runs, freshness. |
| Auth                                          | All                | Google gate. Unauthenticated → 401 on APIs.                     |

Do:

1. Keep admin tools off the trader first screen.
2. Empty-feed copy may mention admin fetch **only for admins**.
3. Never require traders to understand cron / watermarks to use the desk.

---

## 13. What NOT to build (out of scope)

| Do not build now                            | Why                                                             |
| ------------------------------------------- | --------------------------------------------------------------- |
| Full charting platform as the product core  | Wrong lane (Trade Ideas). Split chart is optional context only. |
| Broker / OMS / autotrader                   | Legal + focus                                                   |
| Options-flow / UOA as core                  | Unusual Whales lane; paid redistribute                          |
| Macro / news magazine UX                    | Firehose churn                                                  |
| Community chat as core loop                 | Not the decision product                                        |
| Squawk audio desk as v1                     | TTS ≠ Squawk                                                    |
| Bloomberg multi-asset terminal              | Wrong buyer                                                     |
| Fake “real-time wire speed” on cron/poll    | Trust destroyer                                                 |
| Fake historical reaction numbers            | JTBD 5 rule                                                     |
| Full 22-family taxonomy live on free APIs   | Language ≠ ingest coverage                                      |
| Prop multi-seat SSO before retail FP is low | GTM timing                                                      |
| Loud green/red Benzinga chrome clone        | Clashes with B&W desk                                           |
| Magazine hero overlays on article           | Wrong density                                                   |

Sources: Client Target §7.4, Architecture Later table, Benzinga source map, Engineer roadmaps §5–6.

---

## 14. Engineer implementation checklist (ordered)

Work top to bottom. Check off in the PR description when relevant.

### A. Orient

- [ ] Confirm beachhead persona + JTBD (§1) for this change
- [ ] Confirm surface: Feed / Article / Watchlist / Alerts / Admin
- [ ] Skim `ACCEPTANCE-JTBD.md` for the JTBD you touch

### B. Feed (`/dashboard`)

- [ ] Preserve **Symbol · Title · Time** (+ Action); Earnings filter → Date · Name · Symbol · Period · EPS · Estimation (Visual §1A)
- [ ] Time = event ET timestamp with `tabular-nums`; never DB insert time
- [ ] Event labels from `eventLabel` / `CATEGORY_LABELS` — no duplicate maps
- [ ] Soft-poll + Last updated + stale honesty
- [ ] Filters: symbol, time window (1h/4h/24h/All), category chips
- [ ] Quiet playbook toggle wired to playbook API
- [ ] Row flash for new items; dismiss animation without DB delete

### C. Row actions

- [ ] **Read** → in-app article
- [ ] **Act** → drawer (no DB mutate)
- [ ] **Dismiss** → localStorage list (cap 200)
- [ ] **Quiet** → add symbol to watchlist when present
- [ ] Desktop hover toolbar; mobile always-visible actions
- [ ] Proof / original opens new tab; does not replace Read

### D. Article (`/dashboard/catalyst/[id]`)

- [ ] Symbol-first header + category + materiality
- [ ] WIIM one-liner above summary when available
- [ ] Bullet takeaways (3) preferred over long prose
- [ ] Summary grounded in stored text; secondary Original CTA
- [ ] Detail cards / highlights without green-red chrome overload
- [ ] Historical panel: placeholder only — no fake numbers

### E. Visual system

- [ ] Inter body + Roboto headings + tabular mono nums (`layout.tsx` / `globals.css`)
- [ ] Use `--desk-*` tokens; amber only for live / high / primary actions
- [ ] No purple SaaS / glow / magazine hero

### F. Mobile + states

- [ ] No hover-only critical actions on small screens
- [ ] Empty / loading / error / stale / missing-proof states covered
- [ ] Admin-only ops stay on `/admin`

### G. Verify before merge

- [ ] Run through `ACCEPTANCE-JTBD.md` on `dev` Preview for touched JTBDs
- [ ] Label built vs aspirational honestly in the PR
- [ ] Update this guide if you change column grammar or action semantics

### H. Suggested next product tickets (if starting UI work tomorrow)

1. Dashboard JTBD: Symbol · Title · Time + primary filter order + strip sources (Visual §1A)
2. Earnings alternate columns + Symbol click panel (chart / quote / correlated news)
3. Harden WIIM + bullet summary quality on article view
4. Surface “Why this score?” beside materiality in drawer + article
5. Pre-login: remove demo tape; hero value + CTA only
6. Acceptance pass on `dev` Preview before new chrome

Sources: `ENGINEER-UX-FEATURE-ROADMAP.md` §4–5, Visual roadmap §1A / §5.

---

## 15. Source index

| Doc                                                   | Use for                               |
| ----------------------------------------------------- | ------------------------------------- |
| `ENGINEER-UX-FEATURE-ROADMAP.md`                      | Phased feature roadmap                |
| `ENGINEER-UX-FEATURE-ROADMAP-VISUAL.md`               | Diagrams / priority matrix            |
| `Catalyst-Intel-Client-Target-Guideline.md`           | Personas, JTBD, must-haves, non-goals |
| `Catalyst-Intel-Client-Summary.md`                    | Condensed truth + taxonomy            |
| `Catalyst-Intel-Client-Architecture-and-Flow.md`      | IA, principles, backlog               |
| `Catalyst-Intel-JTBD-UX-UI.md`                        | Implemented UI map + paths            |
| `ACCEPTANCE-JTBD.md`                                  | QA checklist                          |
| `Catalyst-Intel-JTBD-Visual-Preview-README.md`        | Visual language (design-only)         |
| `Catalyst-Intel-Internal-Article-View.md`             | In-app Read vs external proof         |
| `Catalyst-Intel-Benzinga-Like-Article-Display.md`     | Article IA to borrow                  |
| `Catalyst-Intel-Benzinga-Pro-Catalysts-Source-Map.md` | Applied vs paid vs never-claim        |
| `src/lib/catalysts/taxonomy.ts`                       | Category labels (code SoT)            |
| `src/components/live-catalyst-feed.tsx`               | Live column / action SoT              |
| `src/components/catalyst-article-view.tsx`            | Article SoT                           |
| `src/app/layout.tsx` + `src/app/globals.css`          | Fonts + desk tokens                   |

---

_End of implementation guide. Prefer this file for day-to-day UI changes. Prefer the roadmap files for sprint phasing. If a detail conflicts with a source research doc or with live code, update this synthesis in the same change — do not silently diverge._
