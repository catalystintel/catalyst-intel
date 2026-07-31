**Features and Tasks - **

## Shipped in POC (feat/ceo-featureslist-poc)

- [x] Improve the article chart (bottom split-view) — more professional Lightweight Charts UX
- [x] Improve the dark-mode icon
- [x] Remove / soften source API key names in product UI
- [x] Earnings surprises filter — material |EPS surprise %| on Live tape
- [x] Landing Search — 2–3 free ticker lookups + sign-in CTA
- [x] Economic calendar deepened — countdown, why-it-matters, PPI added (no paid econ API)
- [x] Portfolio focus via CSV / paste → watchlist + Quiet playbook (not broker sync)
- [x] Prelogin upward stock chart — already present
- [x] Article images — show vendor thumb when present (details dialog + page)
- [x] PR wire ingest (mandatory) — keyless public high-impact scrape by default (`pr-wire` / “PR Wire”); ~5-day lookback ≈100 receipts; maps `score`/`direction`/`event_type`/`theme` + settled `realized_move_pct` → impact/sentiment/category/`historicalImpact`; sanitized; optional auth full-feed upgrade via env
- [x] PR wire favored on cross-vendor duplicates (highest provider rank)
- [x] Pause ClinicalTrials.gov fetch (daily lag; code kept, `fetchEnabled: false`)
- [x] Pause Polygon news fetch (hourly ticker news; code kept; prices still enrich)
- [x] Keep openFDA fetch active
- [x] Admin non-prod clear DB + migrate + fetch all (`VERCEL_ENV !== production`)

## Deferred (post-POC)

- [ ] Buy/Sell buttons in articles — connect to a trading platform (broker OAuth / compliance)
- [ ] Paid “Economics Trading API” — prefer FMP econ calendar (`FMP_API_KEY` + dedicated ~10m cron); desk embedded calendar remains fallback
- [ ] WhatsApp integration — email/webhook alerts cover notify-me for now
- [ ] Full trading-platform portfolio sync — CSV/paste is the POC substitute
- [ ] Auto-generate article images when vendor has none (optional polish)
- [ ] Re-enable Polygon news only with a true real-time news entitlement
- [ ] Re-enable ClinicalTrials if a faster status-change feed appears
