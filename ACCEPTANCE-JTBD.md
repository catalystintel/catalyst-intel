# Acceptance checklist — JTBD preview

QA this against the **staging / `dev` Preview** URL after merge (not production/`main` unless explicitly promoted).

Preview / staging base: `https://catalyst-intel-git-dev-zhbar10s-projects.vercel.app`  
(Confirm the live Preview hostname in the Vercel dashboard for the `dev` branch if the alias differs.)

Sign in with Google before checking authenticated surfaces.

---

## JTBD 1 — Filing hits → ticker + event + materiality (act / dismiss)

- [ ] Live feed (`/catalyst-feed`) shows **ticker** and **event type** (headline / category) within one soft-poll cycle (~20s when tab focused) after a new SEC ingest.
- [ ] Each row shows a **materiality / impact** badge (High / Medium / Low + numeric score). Scores are rule-based from event category when AI scoring is absent.
- [ ] **Read** (amber) opens the **in-app article** at `/catalyst-feed/catalyst/[id]` (not an external tab).
- [ ] Clicking the row **Title** also navigates to the in-app article.
- [ ] **Dismiss** removes the row from the feed for this browser (local dismiss list); it does not delete the DB row.
- [ ] Article page shows ticker, category, summary, and best-available stored body; secondary CTA opens the original source.

---

## JTBD 2 — Quiet tape → only playbook-matching catalysts

- [ ] `/watchlist` lets you add/remove tickers and toggle playbook categories; Quiet mode can be enabled there.
- [ ] Live feed **Quiet playbook** toggle persists via `/api/playbook` and filters the tape.
- [ ] With Quiet on + non-empty watchlist: only watchlist tickers whose `eventCategory` is in the playbook appear.
- [ ] With Quiet on + empty watchlist: only playbook categories appear (noise filtered by category alone).
- [ ] With Quiet off: full tape respects only the normal Filters panel (ticker / category / time).

---

## JTBD 3 — Headline → in-app article + original proof

- [ ] Every feed row has a visible **Proof / original source** control (desktop Proof column; mobile under the title).
- [ ] Clicking Proof opens the stored vendor URL in a new tab (SEC EDGAR when applicable) and does **not** replace the in-app reader.
- [ ] Title / **Read** open `/catalyst-feed/catalyst/[id]` with summary + stored body inside the app.
- [ ] Article page secondary CTA is **Original on SEC/source** (or provider-specific label).

---

## JTBD 4 — Away → webhook / email rules (push stub)

- [ ] `/alerts` can create a **webhook** rule (URL required) and list/delete it.
- [ ] `/alerts` can create an **email** rule (recipient required). If `RESEND_API_KEY` is unset, Test shows a clear failure mentioning Resend; if set (+ optional `RESEND_FROM_EMAIL`), Test can send.
- [ ] **Push** channel can be saved but Test reports **coming soon** (no FCM).
- [ ] **Test** on a rule POSTs to `/api/alert-rules/test` and returns per-channel result detail against the latest catalyst (force-fire).
- [ ] Default rule UI supports AH/PM session filter + minimum impact score.
- [ ] Auth, rate limits, and SEC cron / admin fetch still work unchanged.

### Env (document for ops)

| Variable            | Required for        | Notes                                |
| ------------------- | ------------------- | ------------------------------------ |
| `RESEND_API_KEY`    | Email delivery      | Optional; webhook works without it   |
| `RESEND_FROM_EMAIL` | Email From override | Defaults to Resend onboarding sender |
| `FINNHUB_API_KEY`   | NYSE listings       | Optional; soft-fail empty UI         |

### NYSE stock data (Finnhub)

Catalyst Intel uses **Finnhub** free-tier US equity symbols, filtered to NYSE
(`mic = XNYS`), stored in `nyse_listings`. Optional last-price enrichment uses
Finnhub `/quote` for a small sample on each admin/cron fetch.

Endpoints:

- `POST /api/admin/fetch/finnhub-nyse` — admin session or `x-cron-secret`
- `GET /api/nyse/symbols?q=&limit=` — authenticated search / empty reason

Get a free key at [finnhub.io](https://finnhub.io).

---

## JTBD 5 — Historical reaction context

- [ ] Drawer shows a **Historical reaction · Coming soon** placeholder.
- [ ] No fake price / prior-move numbers are rendered.

---

## Regression smoke

- [ ] Soft-poll of `/api/catalysts` still works (Last updated advances while tab focused).
- [ ] Admin **Fetch SEC EDGAR now** still works for allowlisted admins.
- [ ] Unauthenticated visitors cannot use watchlist / alerts / catalysts APIs (401).
