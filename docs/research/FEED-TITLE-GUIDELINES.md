# Feed dashboard title guidelines

**Audience:** Engineers wiring tape / Read titles and quality gates  
**Purpose:** Document how each subject’s **Title** cell renders, and the ground-rule format (aligned with Earnings / FDA / Halts).  
**Related:** [`SEC-8K-FORM4-CLASSIFICATION.md`](./SEC-8K-FORM4-CLASSIFICATION.md), `src/lib/catalysts/catalyst-titles.ts`, `src/lib/catalysts/feed-display.ts`

---

## Product rule

Tape titles should answer **what happened** and **to whom** in one glance:

`{Event kind} - {Company Name}`  
or for halts: `Halts ({Company Name}) — {reason}`

Prefer stored ground-rule titles from ingest (`title` / mirrored `headline`) over taxonomy chips (“8-K filing”, “Price target (Street)”).

Separators: ASCII `-` for most `{Event} - {Company}` subjects; em dash `—` for Halts, macro CPI / Jobs Report, and the narrative SEC titles below (424B / 425 / selected 8-K items). Avoid ugly double dashes.

---

## Subject → title

| Subject                                              | Title format                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Earnings                                             | `Earnings Report Qn - {Company Name}` (Finnhub calendar + SEC Item 2.02; tape recomputes legacy rows) |
| FDA Approval                                         | `FDA Approval - {Company Name}`                                                                       |
| Halts                                                | `Halts ({Company Name}) — {reason}`                                                                   |
| Form 4 Buy                                           | `Form 4 Insider Buy - {Company Name}` (mixed → `Form 4 Insider Buy & Sell - {Company}`)               |
| Form 4 Sell                                          | `Form 4 Insider Sell - {Company Name}`                                                                |
| 8-K Material agreement (1.01)                        | `{Company Name} New Deal Announced — Major Contract or Partnership`                                   |
| 8-K Agreement terminated (1.02)                      | `Agreement Terminated - {Company Name}`                                                               |
| 8-K M&A / acquisition closed (2.01)                  | `Acquisition / Disposition Closed - {Company Name}`                                                   |
| 8-K Change of control (5.01)                         | `Change of Control - {Company Name}`                                                                  |
| 8-K Management (5.02)                                | `{Company Name} — Executive Change — CEO/CFO Departure or Appointment`                                |
| 8-K Capital / obligation (2.03, 3.02, …)             | Title Case item label, e.g. `New Financial Obligation - {Company Name}`                               |
| 8-K Bankruptcy (1.03)                                | `{Company Name} — Bankruptcy Filing — Equity at Risk`                                                 |
| 8-K Delisting (3.01)                                 | `{Company Name} — Delisting Risk — Stock Could Lose Its Listing`                                      |
| 8-K Distress (2.04, 2.06, 4.02, …)                   | Title Case item label, e.g. `Debt Acceleration - {Company Name}`                                      |
| 8-K Cyber (1.05)                                     | `Material Cybersecurity Incident - {Company Name}`                                                    |
| 8-K Restructuring (2.05)                             | `Restructuring / Exit Costs - {Company Name}`                                                         |
| 8-K Governance misc (4.01, 5.03, 5.04)               | Title Case item label, e.g. `Auditor Change - {Company Name}`                                         |
| 8-K Non-catalyst only (7.01 / 8.01 / 9.01 / routine) | Suppressed by quality gate (not on tape)                                                              |
| S-3                                                  | `Shelf Registration (S-3) - {Company Name}`                                                           |
| 424B                                                 | `{Company Name} New Stock Offering Filed — Potential Dilution Ahead`                                  |
| 425                                                  | `{Company Name} — Merger or Acquisition News: Deal in Play`                                           |
| 13D                                                  | `Schedule 13D - {Company Name}`                                                                       |
| 13G                                                  | `Schedule 13G - {Company Name}`                                                                       |
| Clinical trials                                      | `Clinical Trial - {Company Name}` (status / study name in Event chip + summary)                       |
| CPI                                                  | `CPI — {Month Year}`                                                                                  |
| Jobs / NFP                                           | `Jobs Report (NFP) — {Month Year}`                                                                    |
| FOMC                                                 | `FOMC Rate Decision`                                                                                  |
| Wire / news                                          | Story headline as-is (no `{Event} - Co` rewrite)                                                      |
| Analyst / price target                               | `Price Target - {Company Name}` / `Analyst Rating - {Company Name}`                                   |

---

## Ground-rule patterns (live formatters)

Implemented in `src/lib/catalysts/catalyst-titles.ts`:

| Pattern                                   | Formatter                          |
| ----------------------------------------- | ---------------------------------- |
| `Halts ({Company}) — {reason}`            | `formatHaltTitle`                  |
| `FDA Approval - {Company}`                | `formatFdaApprovalTitle`           |
| `Earnings Report Qn - {Company}`          | `formatEarningsReportTitle`        |
| Narrative 8-K (1.01 / 1.03 / 3.01 / 5.02) | `formatSec8kItemTitle` (+ helpers) |
| Other `{8-K item label} - {Company}`      | `formatSec8kItemTitle`             |
| `Form 4 Insider Buy/Sell/… - {Company}`   | `formatForm4InsiderTitle`          |
| `Shelf Registration (S-3) - {Company}`    | `formatShelfRegistrationTitle`     |
| 424B dilution narrative                   | `formatProspectusOfferingTitle`    |
| 425 M&A narrative                         | `format425MergerTitle`             |
| `Schedule 13D/G - {Company}`              | `formatSchedule13DTitle` / `13G`   |
| `Clinical Trial - {Company}`              | `formatClinicalTrialTitle`         |
| `CPI — {Month Year}`                      | `formatCpiTitle`                   |
| `Jobs Report (NFP) — {Month Year}`        | `formatJobsReportTitle`            |
| `FOMC Rate Decision`                      | `formatFomcRateDecisionTitle`      |
| `Price Target - {Company}`                | `formatPriceTargetTitle`           |
| `Analyst Rating - {Company}`              | `formatAnalystRatingTitle`         |

Display preference / legacy rewrite: `titleLine` in `src/lib/catalysts/feed-display.ts`.

---

## Ingest wiring (brief)

| Subject family                              | Fetch / normalize                                            |
| ------------------------------------------- | ------------------------------------------------------------ |
| Halts                                       | `fetch-nasdaq-halts.ts` → `formatHaltTitle`                  |
| Earnings (calendar)                         | `fetch-finnhub-catalysts.ts` → `formatEarningsReportTitle`   |
| FDA                                         | `fetch-openfda.ts` / Finnhub FDA → `formatFdaApprovalTitle`  |
| 8-K / Form 4 / S-3 / 424B / 425 / 13D / 13G | `fetch-sec-edgar.ts` + `parse-8k-items.ts` / Form 4 enrich   |
| Clinical                                    | `fetch-clinicaltrials.ts` → `formatClinicalTrialTitle`       |
| Macro (CPI / NFP / FOMC)                    | `fetch-macro-calendar.ts`                                    |
| Wire / news                                 | `fetch-polygon.ts` / Finnhub company news                    |
| Analyst / PT                                | `fetch-finnhub-catalysts.ts` (recommendation + price target) |
