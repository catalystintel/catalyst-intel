# Catalyst Intel — UX / UI Guide

**For engineers who will change the web app.**

One simple read. Who the user is. What each screen must do. What to build. What to skip.

Full detail: [ENGINEER-UX-UI-IMPLEMENTATION-GUIDE.md](./ENGINEER-UX-UI-IMPLEMENTATION-GUIDE.md)  
Hebrew PDF: [pdf/ENGINEER-UX-UI-GUIDE-HE.pdf](./pdf/ENGINEER-UX-UI-GUIDE-HE.pdf)

---

<br>

# Cover

**Product:** Catalyst Intel

**Kind of app:** News / filing catalyst desk for traders

**Your job with this file:** Change the UI so a trader can see a catalyst, understand it fast, and Act or Dismiss.

**Rule of truth:**

Source → story → score → suggestion

(Never the other way around.)

---

<br>

# 1. Who

We build for **event traders**, not chart scanners or options-flow desks.

### Marcus — day trader

- Trades gaps, after-hours, first hour
- Needs fast triage on one screen
- Needs Quiet mode when the open settles

### Priya — event specialist

- Trades filings, FDA, M&A with proof
- Needs clear event labels (especially 8-K items)
- Needs the original source one click away

### Elena — swing around news

- Holds hours to days around big events
- Needs strong watchlist alerts
- Needs less midday noise

### The job (JTBD)

When a filing or market-moving event hits:

1. Know **what it is**
2. Know **why it matters**
3. Know if it **fits my playbook**
4. Then **Act** or **Dismiss**

### Not our user (for now)

- Passive long-term research
- Pure options flow
- Pure technical scanners
- Bloomberg replacement buyers
- Crypto-first / “all news” users

---

<br>

# 2. Screens

Nav order:

1. Feed
2. Watchlists
3. Alerts
4. Archive (later)
5. Admin (ops only)

### Feed — `/dashboard`

- First screen after login
- Live tape of catalysts
- Soft-poll. Show “Last updated”
- Never fake “instant wire” speed

### Article — `/dashboard/catalyst/[id]`

- In-app Read
- Understand the event
- Original source is secondary (new tab)

### Watchlist — `/watchlist`

- Tickers + playbook categories
- Powers Quiet mode on the feed

### Alerts — `/alerts`

- Away from desk
- Webhook / email now
- Push later

### Admin — `/admin`

- Allowlisted ops only
- Fetch / ingest tools
- Keep this off the trader first screen

---

<br>

# 3. Feed

### Desktop columns (current)

Use this order:

1. **Title** — headline
2. **Time** — when the event happened (ET)
3. **Event** — type label (8-K item, halt, FDA…)
4. **Ticker** — symbol
5. **Action** — Read / Act / Dismiss / Quiet

Do **not** invent a new column order unless product asks.

### Title

- Prefer headline
- Else filing title
- Source name can sit under the title in small text

### Time

- Event time in Eastern Time
- Use tabular numbers
- Never show DB insert time as the event time

### Event

- Show the most specific label you have
- Prefer subcategory → type → category
- Use labels from `taxonomy.ts` (`CATEGORY_LABELS`)
- Examples traders care about: Earnings, 8-K items, Trading Halt, Regulatory / FDA, Insider (Form 4), Macro

### Filters to keep

- Ticker / company search
- Time window: 1h / 4h / 24h / All
- Category chips
- Quiet playbook toggle

### Sort

- Newest event time first
- Keep this as the default

### Density

- Rows, not cards
- Dense blotter
- No marketing hero above the tape
- New rows can flash briefly

### Mobile

- Stack under Title: Time → Event → Ticker
- Action buttons always visible
- Do not rely on hover

---

<br>

# 4. Actions

Each feed row needs these four actions.

### Read

- Open the in-app article
- Primary deep-read path

### Act

- Open the quick detail drawer
- Does **not** change the database
- Fast triage only

### Dismiss

- Hide the row in this browser
- Remember the last ~200 ids locally
- Does **not** delete the DB row

### Quiet

- Add the ticker to the quiet watchlist
- Hide the button if there is no ticker
- Disable if already on the watchlist

### Proof / original source

- Opens in a **new tab**
- Never replaces the in-app reader
- If the link is missing, still show a muted “no link” state — do not hide the control

### Quiet playbook (header toggle)

- On + watchlist set → only those tickers in playbook categories
- On + empty watchlist → playbook categories only
- Off → normal filters only

---

<br>

# 5. Article

Build the page in this order:

1. Back to Live tape
2. Large **ticker**
3. Category + materiality
4. Headline + company
5. **WHY IT'S MOVING** (one line)
6. Meta: provider · category · type · time
7. **Summary** as 3 short bullets
8. Detail facts (EPS, revenue, items…) when you have them
9. Article body
10. Filing items / tags
11. **Original source** as secondary button

### Must do

- Ticker first
- WIIM one-liner above the long summary
- Bullets over essay prose
- Ground text in stored source data
- Soft-fail enrichment (quote / related) — do not block the page

### Must not do

- Magazine hero image
- Loud green/red chrome everywhere
- Fake historical price numbers
- Iframe random news sites

### Historical reaction

- Placeholder only for now
- Say “coming soon”
- Show **no** fake prior-move numbers

---

<br>

# 6. Look & feel

### Fonts

- **Inter** — body and UI
- **Roboto** — headings
- **Tabular numbers** — times, prices, tickers (`font-mono`)

Files: `src/app/layout.tsx`, `src/app/globals.css`

### Color

- Black & white mono desk
- Amber only for live / high / primary actions
- High contrast on titles
- Dim text only for meta (source, tags)

### Do not use

- Purple SaaS gradients
- Glow “AI” looks
- Rainbow category colors
- Full green/red terminal skins as the default

### Empty / loading / error

- Empty feed → honest empty (admins can fetch)
- No filter matches → clear message + reset
- Quiet empty → Quiet-specific message
- Loading → desk skeletons, not flashy spinners
- Stale feed → loud banner
- Missing proof → muted stub, control stays visible
- AI down → fall back to stored text; never invent numbers

### Desktop vs mobile

- Desktop = main desk
- Mobile must still open article + proof
- Mobile must still receive alerts / deep links
- Never hide critical actions behind hover on phones

---

<br>

# 7. Do not build

Skip these unless product explicitly asks:

- Full charting as the core product
- Broker / OMS / autotrader
- Options-flow terminal as the core
- News magazine layout
- Community chat as the main loop
- Squawk audio as v1
- Bloomberg-style multi-asset terminal
- Fake “real-time wire” claims on poll/cron
- Fake historical reaction numbers
- Prop SSO before the core desk is sticky

---

<br>

# 8. Step checklist

Do these in order when you change UX.

### Orient

1. Name the user (Marcus / Priya / Elena)
2. Name the screen (Feed / Article / Watchlist / Alerts / Admin)
3. Check `ACCEPTANCE-JTBD.md` for that job

### Feed

4. Keep Title · Time · Event · Ticker · Action
5. Event time in ET with tabular nums
6. Keep filters + Quiet toggle
7. Soft-poll + Last updated + stale honesty

### Actions

8. Read → article
9. Act → drawer (no DB write)
10. Dismiss → local hide only
11. Quiet → add ticker
12. Proof → new tab

### Article

13. Ticker first
14. WIIM one-liner
15. Three summary bullets
16. Original source secondary
17. No fake history numbers

### Look

18. Inter + Roboto + tabular nums
19. B&W desk + amber accents only
20. Empty / loading / error covered
21. Mobile actions visible without hover

### Ship

22. Run the JTBD acceptance checks on `dev` Preview
23. Say clearly in the PR what is built vs aspirational
24. If you change columns or actions, update both guides

---

<br>

# End

Short version of the product:

**A trading desk for catalyst decisions — not a news firehose.**

More depth, tables, and source citations:

→ [ENGINEER-UX-UI-IMPLEMENTATION-GUIDE.md](./ENGINEER-UX-UI-IMPLEMENTATION-GUIDE.md)
