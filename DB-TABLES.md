# Database tables

Source of truth for columns/types: [`src/db/schema.ts`](src/db/schema.ts).
Migrations live in [`drizzle/`](drizzle/). Keep this file in sync whenever the
schema changes — see [`.cursor/skills/db-tables-doc/SKILL.md`](.cursor/skills/db-tables-doc/SKILL.md).

**15 tables** (libSQL / SQLite via Drizzle).

## Core market data

| Table | What’s stored |
| --- | --- |
| `companies` | Issuer master (name, symbol, sector, market cap, exchange, logo) |
| `catalysts` | Normalized tradeable events (filings/news/halts) with scores, AI triage, and enrichment |
| `raw_sources` | Immutable vendor payloads kept for audit/reprocessing/dedup |
| `event_clusters` | Cross-source merges of near-simultaneous events on the same symbol |
| `nyse_listings` | NYSE symbol universe (Finnhub) with optional last-price quotes |

## Users & desk preferences

| Table | What’s stored |
| --- | --- |
| `users` | App accounts (Supabase id, email, role, free/pro) |
| `watchlist_entries` | Per-user symbols the desk cares about |
| `playbook_settings` | Per-user quiet-mode filter (which event categories count as signal) |
| `dismissed_catalysts` | Per-user “dismissed” catalysts so they stay hidden across devices |

## Alerts

| Table | What’s stored |
| --- | --- |
| `alert_rules` | User-defined delivery rules (email/webhook/push/telegram + conditions) |
| `push_subscriptions` | Browser Web Push endpoints/keys per device |
| `alert_deliveries` | Sent/failed/skipped attempts — audit trail + dedup so a rule×catalyst isn’t re-fired |

## Ops / ingest

| Table | What’s stored |
| --- | --- |
| `ingestion_runs` | One row per full fetch orchestration (cron/admin) with aggregate counts and per-source JSON |
| `vendor_fetch_state` | Per-vendor watermark/cursor so failed fetches widen the next catch-up window |

## Reports

| Table | What’s stored |
| --- | --- |
| `saved_reports` | Frozen catalyst digest snapshots with share tokens (don’t drift with the live tape) |

## Data flow

Vendors → `raw_sources` → `catalysts` (+ optional `event_clusters`) → feed / alerts / reports, keyed off `users` prefs and ops state in `ingestion_runs` / `vendor_fetch_state`.
