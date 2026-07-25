# Feed dashboard title guidelines

**Audience:** Engineers wiring tape / Read titles and quality gates  
**Purpose:** Document how each subject’s **Title** cell renders today, and the recommended ground-rule format (aligned with Earnings / FDA / Halts).  
**Related:** [`SEC-8K-FORM4-CLASSIFICATION.md`](./SEC-8K-FORM4-CLASSIFICATION.md), `src/lib/catalysts/catalyst-titles.ts`, `src/lib/catalysts/feed-display.ts`

---

## Product rule

Tape titles should answer **what happened** and **to whom** in one glance:

`{Event kind} - {Company Name}`  
or for halts: `Halts ({Company Name}) — {reason}`

Prefer stored ground-rule titles from ingest (`title` / mirrored `headline`) over taxonomy chips (“8-K filing”, “Price target (Street)”).

---

## Subject → title (today vs recommended)

| Subject                                              | How title shows TODAY                                                                                                                | Recommended title format                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Earnings                                             | `Earnings Report Qn - {Company Name}` (Finnhub calendar + SEC Item 2.02; tape recomputes legacy “Results of Operations…” rows)       | `Earnings Report Qn - {Company Name}`                                                                  |
| FDA Approval                                         | `FDA Approval - {Company Name}` (openFDA ORIG + Finnhub approval-like rows)                                                          | `FDA Approval - {Company Name}`                                                                        |
| Halts                                                | `Halts ({Company Name}) — {reason}` (Nasdaq reason code → label)                                                                     | `Halts ({Company Name}) — {reason}`                                                                    |
| Form 4 Buy                                           | `Form 4 Insider Buy - {Company Name}` after ownership XML enrich; unenriched soft-keep uses `Form 4 Insider Transaction - {Company}` | `Form 4 Insider Buy - {Company Name}`                                                                  |
| Form 4 Sell                                          | `Form 4 Insider Sell - {Company Name}` (same enrich path; mixed → `Form 4 Insider Buy & Sell - {Company}`)                           | `Form 4 Insider Sell - {Company Name}`                                                                 |
| 8-K Material agreement (1.01)                        | `{Item label} - {Company}` e.g. `Material agreement - Acme Corp` (sentence-case catalog label)                                       | `Material Agreement - {Company Name}`                                                                  |
| 8-K Agreement terminated (1.02)                      | `Agreement terminated - {Company}`                                                                                                   | `Agreement Terminated - {Company Name}`                                                                |
| 8-K M&A / acquisition closed (2.01)                  | `Acquisition / disposition closed - {Company}`                                                                                       | `Acquisition / Disposition Closed - {Company Name}`                                                    |
| 8-K Change of control (5.01)                         | `Change of control - {Company}`                                                                                                      | `Change of Control - {Company Name}`                                                                   |
| 8-K Management (5.02)                                | `Officer / director change - {Company}`                                                                                              | `Officer / Director Change - {Company Name}`                                                           |
| 8-K Capital / obligation (2.03, 3.02, …)             | e.g. `New financial obligation - {Company}`, `Unregistered equity sale - {Company}`                                                  | `New Financial Obligation - {Company Name}` / `Unregistered Equity Sale - {Company Name}` (match item) |
| 8-K Distress (1.03, 2.04, 2.06, 3.01, 4.02, …)       | e.g. `Bankruptcy / receivership - {Company}`, `Delisting risk - {Company}`                                                           | `Bankruptcy / Receivership - {Company Name}` / `Delisting Risk - {Company Name}` (match item)          |
| 8-K Cyber (1.05)                                     | `Material cybersecurity incident - {Company}`                                                                                        | `Material Cybersecurity Incident - {Company Name}`                                                     |
| 8-K Restructuring (2.05)                             | `Restructuring / exit costs - {Company}`                                                                                             | `Restructuring / Exit Costs - {Company Name}`                                                          |
| 8-K Governance misc (4.01, 5.03, 5.04)               | e.g. `Auditor change - {Company}`                                                                                                    | `Auditor Change - {Company Name}` (Title Case item label)                                              |
| 8-K Non-catalyst only (7.01 / 8.01 / 9.01 / routine) | Suppressed by quality gate (not on tape)                                                                                             | _(suppress — no title)_                                                                                |
| S-3                                                  | Stored `{Company} — S-3 filing`; tape often shows `{Company} — Shelf registration (S-3)`                                             | `Shelf Registration (S-3) - {Company Name}`                                                            |
| 424B                                                 | Stored `{Company} — 424B… filing`; tape often `{Company} — Prospectus / offering (424B)`                                             | `Prospectus / Offering (424B) - {Company Name}`                                                        |
| 13D                                                  | Stored `{Company} — …13D… filing`; tape often `{Company} — Beneficial ownership (13D)`                                               | `Schedule 13D - {Company Name}`                                                                        |
| 13G                                                  | Stored `{Company} — …13G… filing`; tape often `{Company} — Beneficial ownership (13G)`                                               | `Schedule 13G - {Company Name}`                                                                        |
| Clinical trials                                      | Ingest stores `{Sponsor} — {study title}`, but tape `titleLine` often prefers status headline (e.g. `Recruiting`)                    | `Clinical Trial - {Company Name}` (keep study name in summary / tooltip)                               |
| CPI                                                  | `CPI — {forMonth}` (macro calendar; headline chip stripped)                                                                          | `CPI — {Month Year}`                                                                                   |
| Jobs / NFP                                           | `NFP / Employment Situation — {forMonth}`                                                                                            | `Jobs Report (NFP) — {Month Year}`                                                                     |
| FOMC                                                 | `FOMC rate decision`                                                                                                                 | `FOMC Rate Decision`                                                                                   |
| Wire / news                                          | Polygon/Benzinga Wire: raw article `title` (publisher chip not used as title). Finnhub company news: story headline                  | Keep story headline as-is (no `{Event} - Co` rewrite)                                                  |
| Analyst / price target                               | Tape often shows taxonomy chips (`Price target (Street)`, `Analyst ratings (consensus)`) instead of `{Ticker} — …` stored titles     | `Price Target - {Company Name}` / `Analyst Rating - {Company Name}`                                    |

---

## Ground-rule patterns (live formatters)

Implemented in `src/lib/catalysts/catalyst-titles.ts`:

| Pattern                                 | Formatter                   |
| --------------------------------------- | --------------------------- |
| `Halts ({Company}) — {reason}`          | `formatHaltTitle`           |
| `FDA Approval - {Company}`              | `formatFdaApprovalTitle`    |
| `Earnings Report Qn - {Company}`        | `formatEarningsReportTitle` |
| `{8-K item label} - {Company}`          | `formatSec8kItemTitle`      |
| `Form 4 Insider Buy/Sell/… - {Company}` | `formatForm4InsiderTitle`   |

Display preference / legacy rewrite: `titleLine` in `src/lib/catalysts/feed-display.ts`.

---

## Ingest wiring (brief)

| Subject family                        | Fetch / normalize                                            |
| ------------------------------------- | ------------------------------------------------------------ |
| Halts                                 | `fetch-nasdaq-halts.ts` → `formatHaltTitle`                  |
| Earnings (calendar)                   | `fetch-finnhub-catalysts.ts` → `formatEarningsReportTitle`   |
| FDA                                   | `fetch-openfda.ts` / Finnhub FDA → `formatFdaApprovalTitle`  |
| 8-K / Form 4 / S-3 / 424B / 13D / 13G | `fetch-sec-edgar.ts` + `parse-8k-items.ts` / Form 4 enrich   |
| Clinical                              | `fetch-clinicaltrials.ts` (`{sponsor} — {title}`)            |
| Macro (CPI / NFP / FOMC)              | `fetch-macro-calendar.ts`                                    |
| Wire / news                           | `fetch-polygon.ts` / Finnhub company news                    |
| Analyst / PT                          | `fetch-finnhub-catalysts.ts` (recommendation + price target) |

---

## Implementation notes (follow-ups)

1. **Title Case 8-K labels** — catalog labels in `ITEM_CATALOG` are sentence case; research + this doc recommend Title Case for tape consistency with Earnings/FDA.
2. **Offerings & ownership** — extend ground-rule formatters (or SEC ingest) so S-3 / 424B / 13D / 13G store `{Kind} - {Company}` instead of `{Company} — {form} filing`.
3. **Clinical + analyst** — fix `titleLine` so status / Street chips do not win over a composed ground-rule title.
4. **Wire** — do not force a company suffix when the headline already names the issuer; Event / ticker columns carry identity.
   )
