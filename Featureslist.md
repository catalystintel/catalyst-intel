# Features list — POC strategy

## 1. POC goal

Ship a **web app for market-moving events** (not a news reader): filtering, speed, and relevance for traders’ books — and prove the **act-faster** edge (catalyst → trade path).

---

## 2. P0 — Crucial for POC

- **RTPR via API** (not website scrape) for real-time PR / catalyst supply
- **Watchlist / portfolio focus** — CSV or manual entry first; broker sync later
- **Earnings surprises filter** — beat/miss vs estimates (surface only material surprises)
- **Thin Buy/Sell in articles** — deep-link / open broker with symbol to prove time-to-order edge; full broker OAuth later
- **Remove source keys / irrelevant UI clutter** — keep the desk focused on events that matter
- **Google login solid** — reliable auth; profile as needed

---

## 3. P1 — Strong differentiators

- **Economic calendar API** — correlate macro events to trader relevance / watchlist
- **Landing search** — 2–3 free symbol lookups for instant event context
- **Article / split chart polish** — Lightweight Charts on `dev` (example in place; deepen for production polish)

---

## 4. P2 — After POC / polish

- **WhatsApp filtered alerts** — opt-in, subject-filtered notifications without visiting the site
- **Auto images** (optional) — relevant imagery on articles for context / polish
- **Dark-mode icon** — improve theme toggle affordance
- **Full trading-platform connect / portfolio broker sync** — beyond thin Buy/Sell deep-links

---

## 5. Done / shipped (brief)

- Prelogin upward / rising chart atmosphere on the landing hero
- Google OAuth sign-in (Supabase) as the auth path
- Desk feed + split / details hierarchy for catalyst events
- Lightweight Charts example on `dev` (chart polish continues under P1)

---

## 6. How we validate (not a news site)

| Signal                           | What “good” looks like                                                 |
| -------------------------------- | ---------------------------------------------------------------------- |
| **Event, not article**           | Users treat rows as catalysts (actionable events), not a headline feed |
| **Latency**                      | Catalyst appears fast enough to matter vs discovering it elsewhere     |
| **Watchlist / surprise filters** | Traders can focus on their book and material earnings surprises        |
| **Buy/Sell click rate**          | Thin Buy/Sell is used — proves interest in catalyst → order path       |
| **Qualitative feedback**         | Traders say it helps them act faster on what matters to their book     |
