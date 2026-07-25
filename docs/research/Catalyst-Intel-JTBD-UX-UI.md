# Catalyst Intel — JTBD UX / UI (Preview)

Documented from the **implemented preview** UI under `src/` (not a design mockup).  
Companion QA checklist: repo `ACCEPTANCE-JTBD.md`.

**Primary surface:** authenticated desk shell (`AppShell` + sidebar) after Google sign-in.  
**Live tape route:** `/dashboard` (“Latest News”).  
**Related routes:** `/watchlist`, `/alerts`, `/admin` (ingest).

---

## Shell & navigation

| Element                | Behavior                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Sidebar                | Brand mark + “Catalyst Intel”; primary nav                                          |
| Live JTBD routes       | **Dashboard** → `/dashboard`, **Watchlists** → `/watchlist`, **Alerts** → `/alerts` |
| Coming soon (disabled) | News Feed, Reports, Analytics                                                       |
| Admin                  | “Admin” + Fetch SEC EDGAR (allowlisted only)                                        |

Components: `src/components/app-shell.tsx`, `src/components/app-sidebar.tsx`, `src/lib/nav/nav-items.ts`.

---

## JTBD 1 — Filing hits → symbol + event + materiality (Act / Dismiss)

**Job:** When a filing hits, see symbol, event, and materiality quickly; Act to inspect or Dismiss noise.

### Screen: Latest News (`/dashboard`)

Panel title **Latest News**. Soft-polls `/api/catalysts` (~20s focused, ~90s blurred; paused when tab hidden). New rows flash briefly (`row-flash`). “Last updated” + manual refresh.

### Desktop column model

| Column header      | Content                                                              |
| ------------------ | -------------------------------------------------------------------- |
| **Symbol / Event** | Mono symbol + event line (headline or category / type)               |
| **Sector**         | `SectorPill` (company sector → category label → “SEC Filings”)       |
| **Impact**         | `MaterialityBadge` — numeric score + High / Medium / Low             |
| **Title**          | Headline preferred, else filing title; source name under Act/Dismiss |
| **Proof**          | Compact EDGAR control (see JTBD 3)                                   |
| **Time**           | Clock + date (`formatTimeDate`)                                      |

> Note: Older copy sometimes said Source \| Sector \| Title \| Time. The live grid is **Symbol/Event · Sector · Impact · Title · Proof · Time**. Source (“SEC EDGAR”) appears under the title actions on desktop and in the drawer.

### Mobile

Title + stacked symbol, impact badge, compact Proof, clock time; Act / Dismiss below.

### Interactions

| Control                   | Behavior                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Row click / Enter / Space | Opens detail drawer for that catalyst                                                                                   |
| **Act**                   | Opens / focuses the same drawer (does not mutate DB)                                                                    |
| **Dismiss**               | Hides row in this browser via `localStorage` key `ci.dismissed-catalyst-ids` (last 200 ids); does **not** delete DB row |
| Filters                   | Symbol search, time window (1h / 4h / 24h / All), category chips (“All sectors” + counts)                               |

Empty states: no catalysts yet (admin prompted to fetch); or no filter matches.

### Drawer (same JTBD)

Repeats symbol, company name, category badge, materiality, Act / Dismiss, Source / Sector / Form / Age / Filed, filing items or summary.

**Components:** `live-catalyst-feed.tsx`, `materiality-badge.tsx`, `sector-pill.tsx`, `category-badge.tsx`, `catalyst-detail-drawer.tsx`.

---

## JTBD 2 — Quiet tape → only playbook-matching catalysts

**Job:** On a quiet tape, show only watchlist + playbook-matching catalysts.

### Screen A: Watchlist & playbook (`/watchlist`)

Eyebrow **Quiet tape**. Two panels:

1. **Watchlist symbols** — add (mono input + Add), remove (trash). Empty → quiet mode filters by categories only.
2. **Playbook categories** — toggle chips for all event categories; **Quiet mode on/off** persists via `PUT /api/playbook`.

### Screen B: Live feed Quiet toggle

Header button **Quiet playbook** (live accent + dot when on). Persists same playbook API. Filters panel shows: watchlist symbol count · playbook category count · link to edit under Watchlists.

### Filter logic (when Quiet on)

| Watchlist | Result                                                      |
| --------- | ----------------------------------------------------------- |
| Non-empty | Only watchlist symbols whose `eventCategory` is in playbook |
| Empty     | Only playbook categories (noise filtered by category alone) |
| Quiet off | Full tape + normal Filters only                             |

Empty quiet message: _“Quiet playbook: no watchlist/playbook matches right now.”_

**Components:** `watchlist-playbook-panel.tsx`, quiet toggle + `matchesQuietPlaybook` in `live-catalyst-feed.tsx`, `src/lib/catalysts/playbook.ts`.  
**Page:** `src/app/watchlist/page.tsx`.

---

## JTBD 3 — Headline → one-click EDGAR proof

**Job:** From any headline, open the SEC accession proof without hunting.

### Feed

- Desktop: **Proof** column — compact `EdgarProofLink` (“EDGAR”).
- Mobile: under title — compact link.
- Click stops row selection; opens `sourceUrl` in a **new tab**.

### Drawer

Always shows **Proof (EDGAR)** section:

- URL present → “Open EDGAR proof”
- Missing → muted stub “No EDGAR link” / compact “—” (control never hidden)

**Component:** `src/components/edgar-proof-link.tsx` (used in feed + drawer).

---

## JTBD 4 — Away → webhook / email rules (push stub)

**Job:** Away from the desk, get AH/PM bombs via webhook or email.

### Screen: Alert rules (`/alerts`)

Eyebrow **Away desk**.

**New alert rule**

| Field                  | Notes                                            |
| ---------------------- | ------------------------------------------------ |
| Name                   | Default “AH/PM bombs”                            |
| Channel                | Webhook · Email · Push (coming soon)             |
| Min impact             | Default `70`                                     |
| AH / PM only           | Checkbox → sessions `["AH","PM"]` else `["any"]` |
| Webhook URL / Email To | Shown by channel                                 |
| Save rule              | `POST /api/alert-rules`                          |

Copy notes: webhook always works; email needs `RESEND_API_KEY`; push stubbed until FCM.

**Saved rules**

- Name, channel, destination, min impact, sessions
- **Test** → `POST /api/alert-rules/test` (force against latest catalyst); shows per-channel ok/fail detail
- Delete

**Component:** `src/components/alert-rules-panel.tsx`.  
**Page:** `src/app/alerts/page.tsx`.

---

## JTBD 5 — Historical reaction context

**Job:** See prior-move context after similar catalysts (not yet shipped).

### Drawer placeholder only

Dashed panel:

- Label: **Historical reaction**
- Body: _“Coming soon — prior move context after similar catalysts will land here. No synthetic history is shown.”_

No fake price / prior-move numbers.

**Location:** `catalyst-detail-drawer.tsx`.

---

## Supporting UX (ingestion)

Admin **Fetch SEC EDGAR now** populates the Live feed (`src/app/admin/page.tsx`, `src/app/admin/fetch-trigger.tsx`). Empty feed copy points admins here.

---

## Interaction summary (all JTBDs)

```
Sign in → Dashboard (Latest News)
  ├─ Soft-poll tape · Filters · Quiet playbook
  ├─ Row → Drawer (Act) · Dismiss (local)
  ├─ Proof → EDGAR new tab
  └─ Drawer → Historical reaction placeholder
Watchlists → symbols + playbook categories + Quiet mode
Alerts → webhook / email rules · Test · Push stub
Admin → Fetch SEC EDGAR (allowlist)
```

---

## Related UI file paths

### Pages

- `src/app/dashboard/page.tsx` — Live feed host
- `src/app/watchlist/page.tsx` — Watchlist & playbook
- `src/app/alerts/page.tsx` — Alert rules
- `src/app/admin/page.tsx` — SEC fetch (supporting)
- `src/app/login/page.tsx` — Auth gate

### JTBD components

- `src/components/live-catalyst-feed.tsx` — Tape, columns, Quiet, Act/Dismiss, filters, poll
- `src/components/catalyst-detail-drawer.tsx` — Detail, Proof, historical stub
- `src/components/edgar-proof-link.tsx` — One-click EDGAR proof
- `src/components/watchlist-playbook-panel.tsx` — Symbols + playbook
- `src/components/alert-rules-panel.tsx` — Away-desk rules
- `src/components/materiality-badge.tsx` — Impact High/Med/Low + score
- `src/components/sector-pill.tsx` — Sector column
- `src/components/category-badge.tsx` — Event category in drawer
- `src/components/app-shell.tsx` / `app-sidebar.tsx` — Desk chrome
- `src/components/live-header-status.tsx` — Live status chrome (if present in shell)
- `src/app/admin/fetch-trigger.tsx` — Admin ingest CTA

### Display / playbook helpers (UI-facing)

- `src/lib/catalysts/feed-display.ts` — Source / sector / title helpers
- `src/lib/catalysts/feed-catalyst.ts` — Feed row shape
- `src/lib/catalysts/playbook.ts` — Quiet playbook match
- `src/lib/catalysts/materiality.ts` — Score → tier
- `src/lib/nav/nav-items.ts` — Sidebar destinations

### Acceptance / schema (not UX mocks)

- `ACCEPTANCE-JTBD.md` — QA checklist for preview
- `drizzle/0002_jtbd_watchlist_alerts.sql` — Watchlist / alerts schema

**No dedicated in-repo `UX-JTBD*` design file existed;** this Downloads doc is the UX/UI map of the JTBD preview as coded.
