# Catalyst / news product — conversation subjects summary

**Audience:** Engineers and product working on Catalyst Intel’s day-trader catalyst tape  
**Purpose:** One readable map of subjects from the long Catalyst Intel build conversation that matter for **catalysts / news trading** — grounded in chat + `docs/research/` + `ACCEPTANCE-JTBD.md`.  
**Not included:** Ops trivia (every empty-commit SHA, one-off deploy chatter) unless it affects news reliability.  
**Status:** Synthesis (Jul 2026). Prefer source research docs when a detail conflicts.

---

## 1. Product intent

**What it is:** A decision / triage desk for **event** traders — detect material catalysts at primary sources, classify, score materiality, contextualize, then **Act or Dismiss**.

**Beachhead personas** (from Client Target / Engineer roadmap):

| Persona                  | Need                                               |
| ------------------------ | -------------------------------------------------- |
| Catalyst day trader      | Fast EDGAR triage, impact tier, quiet mode         |
| Event-driven specialist  | 8-K item taxonomy, proof links, structured filters |
| Active swing around news | High-signal watchlist alerts, less midday noise    |

**Primary JTBD:**

> When a filing or market-moving event hits, understand what it is, why it matters, and whether it fits my playbook in seconds — then Act or Dismiss with confidence.

**Job chain:** Detect → Classify → Score → Contextualize → Decide (Act/Dismiss) → Monitor (watchlist / quiet) → Learn (later).

**Positioning wedge (protect this):**

- Primary source → taxonomy → materiality → Act/Dismiss; then attach price/volume/history.
- Not a news firehose, not Bloomberg, not options-flow or technical scanning.
- Do **not** claim: faster than Benzinga wire; Bloomberg killer; guaranteed edge; “verified AI” without source UX.

**Acceptance surfaces:** `ACCEPTANCE-JTBD.md` (JTBD 1–5) against **staging / `dev` Preview**, not prod unless promoted.

---

## 2. Feed UX

### Live tape (`/dashboard` — “Latest News”)

- Soft-polls `GET /api/catalysts` (~20s focused / ~90s blurred; paused when tab hidden).
- **Act** opens in-app Read / drawer; **Dismiss** hides row in-browser (`localStorage`, last 200 ids) — does **not** delete DB rows.
- Materiality badge: High / Medium / Low + numeric score (rule-based when AI scoring absent).
- Filters: symbol, time window (1h / 4h / 24h / All), category chips; **Quiet playbook** via `/watchlist` + `/api/playbook`.

### Column model (live grid)

**Symbol/Event · Sector · Impact · Title · Proof · Time**

Older “Source | Sector | Title | Time” (or Title | Time | Event) copy is superseded for the live grid. Source (e.g. SEC EDGAR) appears under title actions / drawer.

### Article / Read (`/dashboard/catalyst/[id]`)

- In-app article: symbol, category, summary, best-available stored body.
- **Proof** / secondary CTA opens original vendor URL (SEC EDGAR when applicable) in a new tab — does not replace the reader.
- **WIIM-lite** already in pipeline (`deriveWhyMoving` + optional session Δ); roadmap P0 is a WIIM-style one-liner + short bullet summary on Read (Benzinga IA borrow, not clone).
- Full HTML scrape of vendor pages is intentionally out of scope (robots/ToS); surface vendor-provided text from ingest payloads.

### Related surfaces

| Route        | Role                                             |
| ------------ | ------------------------------------------------ |
| `/watchlist` | Symbols + playbook categories + Quiet mode       |
| `/alerts`    | Webhook / email rules; push stub (“coming soon”) |
| `/admin`     | Allowlisted ingest triggers + fetch order UI     |

IA priority: **Feed → Watchlists → Alerts → Archive → Admin** (Archive still a gap).

---

## 3. Data sources / ETL

Orchestrator: Must → Should display order; runtime phases A (keyless parallel) → B (optional keys) → C (Polygon sequential for shared REST budget). Documented in `Catalyst-Intel-API-Fetch-Order-and-Status.md` / `FETCH-ORDER.md`.

| #   | Source                 | Priority | Keyless vs keyed                         | Role on the tape                                     |
| --- | ---------------------- | -------- | ---------------------------------------- | ---------------------------------------------------- |
| 1   | **SEC EDGAR**          | Must     | Keyless (UA required)                    | 8-K, Form 4 buy/sell, S-3, 424B, SC 13D/G            |
| 2   | **Nasdaq Halts**       | Must     | Keyless RSS                              | Halt / resume                                        |
| 3   | **Finnhub**            | Should   | `FINNHUB_API_KEY` (soft-skip)            | Earnings / FDA / classified news / recent PT / IPO   |
| 4   | **openFDA**            | Must     | Keyless (optional key for higher limits) | Drug approval submissions                            |
| 5   | **ClinicalTrials.gov** | Must     | Keyless                                  | Trial study updates                                  |
| 6   | **Polygon news**       | Should   | `POLYGON_API_KEY` / `MASSIVE_API_KEY`    | Market news; Benzinga publisher → **Benzinga Wire**  |
| 7   | **Polygon prices**     | Should   | Same key                                 | Session % / `historical_impact` for WIIM-lite        |
| 8   | **Form4API**           | Should   | Optional key                             | Intentionally skipped — EDGAR Form 4 covers insiders |

**Also applied:** keyless **macro calendar** (CPI / NFP / FOMC → `eventCategory: macro`). FRED live prints = later.

**Honest constraint:** No free, redistributable, sub-second full-taxonomy wire. Free sources excel at filings, calendars, structured gov data; Benzinga-class editorial RT is paid / licensed.

**Soft-skip vs error:** Missing optional keys → `skipped` (not outage). Hard HTTP/auth failures → `error`. Polygon free-tier 429/403 should soft-handle (defer / mark unavailable), not spam hard errors.

---

## 4. Store — Turso / libSQL

- App data lives in **libSQL** (local `file:local.db` or hosted **Turso**). Supabase Postgres is **auth only**, not the catalyst store.
- Production / Preview on Vercel: set **`LIBSQL_URL`** + **`LIBSQL_AUTH_TOKEN`** (separate DBs for staging vs production).
- Schema path: `raw_sources` → `catalysts` / `companies` (+ user prefs, listings, etc.). Drizzle migrations must stay in sync (`drizzle/` + `src/db/schema.ts`).
- If URL/token missing or wrong on Vercel, Auth can succeed while the desk falls back / fails DB reads — feed looks empty or broken.

---

## 5. Ingest / cron

| Trigger                             | Auth                                 | Notes                                |
| ----------------------------------- | ------------------------------------ | ------------------------------------ |
| Admin UI `/admin`                   | Supabase session + email allowlist   | “Fetch SEC EDGAR” / “Fetch all”      |
| `POST /api/admin/fetch/*`           | Admin session **or** `x-cron-secret` | Same jobs as cron                    |
| GitHub Actions cron                 | `CRON_SECRET` matching Vercel env    | Best-effort; often drifts past 5 min |
| `npm run cron`                      | Local process                        | Local only                           |
| `GET /api/catalysts` stale backstop | Authenticated reader; non-blocking   | Refetch when data older than ~4 min  |

**Env that matters for ingest:** `CRON_SECRET`, `SEC_EDGAR_USER_AGENT`, optional vendor keys above. Staging cron needs `STAGING_APP_URL` (+ staging secret) or manual admin fetch.

Cron is **not** wire-speed; UI must stay latency-honest (event time / last updated).

---

## 6. Auth / admin

- **Google sign-in** via **Supabase Auth**; app users synced into libSQL.
- Authenticated APIs for catalysts / watchlist / alerts (401 when signed out).
- **Admin allowlist:** `ADMIN_EMAILS` (defaults include project admins); gates `/admin` and manual fetch.
- Cron path bypasses session via `CRON_SECRET` only — keep secrets aligned between GHA and Vercel (mismatch → 401 on probe).

---

## 7. Font / typography decision

**Decision (news desk):** **Inter** (body / UI / mono figures) + **Roboto** (headings).

- Wired in `src/app/layout.tsx` + `globals.css` (`--font-inter`, `--font-roboto`, `--font-heading`).
- Replaces earlier persona/mock direction of **DM Sans / IBM Plex**-style stacks for a denser trading-desk read.
- Tracked in product as **PR #103** (typography for the catalyst news UI).

Charcoal / steel / amber desk language remains the visual contract — not purple SaaS chrome.

---

## 8. Engineer roadmap / Benzinga-relevant features

Synthesis: `ENGINEER-UX-FEATURE-ROADMAP.md` (+ visual companion). **Borrow IA; do not clone the terminal.**

### Already applied / partial (do not re-invent)

- Calendar-like taxonomy panels (earnings, regulatory, deals, capital, analyst, macro, …)
- SEC forms tagged with BZ calendar analogs; Read “BZ panel” analog
- Nasdaq halts parity
- Polygon Benzinga publisher → **Benzinga Wire** label (when keyed)
- WIIM-lite; Finnhub analyst rec/PT (partial); keyless macro schedule

### Prioritized next (news-product relevant)

1. Read triage: WIIM one-liner + bullet summary
2. Explainable materiality (“Why this score?”)
3. Harden 8-K item → category; duplicate suppression; latency honesty
4. Liquidity guards; Quiet/playbook onboarding
5. Alert depth; Archive/Search; real historical analogs (replace JTBD 5 placeholder — no fake numbers)

### Buy / license later (only when retention funds it)

Enterprise Wire redistribute · ratings firehose · UOA/Signals tier · Finnhub commercial at scale. **Skip Squawk** until a human desk budget.

---

## 9. Known limits (affect the news product)

| Limit                          | Impact on tape                                                             |
| ------------------------------ | -------------------------------------------------------------------------- |
| **SEC timeouts**               | Serverless → EDGAR `ETIMEDOUT` common; failure cooldown on stale backstop  |
| **GHA cron drift**             | Configured ~5 min but often 45 min–hours; self-heal poll keeps tape usable |
| **Polygon free tier**          | ~5 REST req/min; same-day aggs often 403; soft-handle 429/403              |
| **Vercel Hobby cron**          | Once/day only — hence GHA + read-path backstop, not Vercel Cron alone      |
| **Hobby-safe redeploy author** | Empty-commit redeploys must use `zhbar10` / `zhbar10@gmail.com`            |
| **Finnhub free license**       | Strong for prototype; weak redistribute rights for commercial SaaS         |
| **Dismissals local-only**      | Not multi-device until server-side persist                                 |
| **Push alerts**                | Stubbed (no FCM)                                                           |
| **Historical reaction**        | Placeholder only — never invent price/prior-move numbers                   |

---

## 10. Explicitly out of scope for the news product

Do not build unless product reopens:

- Full charting platform / broker OMS / autotrader
- Options-flow / UOA as core product
- Macro/news magazine UX or community chat as core loop
- Squawk audio desk (TTS ≠ Squawk)
- Bloomberg / multi-asset terminal replacement
- Claiming “real-time wire speed” on cron/poll alone
- Fake historical reaction numbers
- Full 22-family taxonomy live on free APIs alone
- Prop multi-seat SSO before beachhead FP is solid
- Full HTML article scrape of third-party sites

---

## Ops that affect news reliability (brief)

These are not “product features,” but they decide whether the tape has data:

1. **`LIBSQL_URL` / `LIBSQL_AUTH_TOKEN`** present and pointing at the right Turso DB for Preview vs Production.
2. **Migrate** on merge/deploy (`drizzle-kit migrate` in build / `migrate.yml` / admin migrate) so new columns/tables exist before code expects them.
3. **Redeploy** after env or migration fixes (Hobby-safe empty commit as `zhbar10`) so the running build picks up config.
4. **Stale / empty tape:** check cron secret alignment, last ingest run on `/admin`, SEC timeout cooldowns, and DB-not-configured errors — not only the UI.

Without a healthy DB + ingest path, feed UX and JTBD QA are meaningless.

---

## Source index

| Doc                                                   | Use for                              |
| ----------------------------------------------------- | ------------------------------------ |
| `ACCEPTANCE-JTBD.md`                                  | QA checklist on `dev` Preview        |
| `ENGINEER-UX-FEATURE-ROADMAP.md`                      | Sprint synthesis / phases            |
| `Catalyst-Intel-JTBD-UX-UI.md`                        | Implemented feed / article UX        |
| `Catalyst-Intel-Client-Target-Guideline.md`           | Personas, must-haves, non-goals      |
| `Catalyst-Intel-Benzinga-Pro-Catalysts-Source-Map.md` | Applied vs paid vs never-claim       |
| `Catalyst-Intel-Benzinga-Like-Article-Display.md`     | WIIM / article IA to borrow          |
| `Catalyst-Intel-API-Fetch-Order-and-Status.md`        | Fetch order, keyless vs keyed        |
| `Catalyst-Intel-Sources-and-Schema-Recommendation.md` | Source stack depth                   |
| `Catalyst-Intel-Architecture-Flow.md`                 | Turso, cron, auth flow               |
| `DEPLOYMENT.md`                                       | Env vars, migrate, Hobby cron limits |

---

_End of conversation subjects summary. Update this file when product decisions change; do not invent features beyond chat + research grounding._
