# Feed dashboard title guidelines

**Audience:** Engineers wiring tape / Read titles and quality gates  
**Purpose:** Document how each subject’s **Title** cell renders, and the ground-rule format (aligned with Earnings / FDA / Halts).  
**Related:** [`SEC-8K-FORM4-CLASSIFICATION.md`](./SEC-8K-FORM4-CLASSIFICATION.md), `src/lib/catalysts/catalyst-titles.ts`, `src/lib/catalysts/feed-display.ts`

---

## Product rule

Tape titles should answer **what happened** and **to whom** in one glance:

`{Company Name} - {Event phrase}`  
or for halts: `Halts ({Company Name}) - {reason}`  
or for FDA approvals: `{Company Name} Receives FDA Approval!`  
or for acquisition announcements: `{Company Name} - Acquisition Announced (Deal in Play)`

Prefer stored ground-rule titles from ingest (`title` / mirrored `headline`) over taxonomy chips (“8-K filing”, “Price target (Street)”).

**Fact-rich override:** When enrich extracts real `keyFacts` (size, parties, phase, agency outcome, etc.), `buildSubjectTitle` / `preferSubjectTitle` in `src/lib/catalysts/subject-titles.ts` may use freer, subject-specific wording from [`ARTICLE_BY_SUBJECT.md`](../product/ARTICLE_BY_SUBJECT.md). Those fact titles win over cookie-cutter chips — still never invent numbers. Ground-rule rows below remain the thin-fact / pre-enrich fallback.

**When to use thin (capital / deals / partnership / regulatory / clinical):**

| Situation                                      | Use thin ground-rule voice                                    |
| ---------------------------------------------- | ------------------------------------------------------------- |
| S-3 with no extracted size / ATM detail        | `{Company} - Shelf Registration Filed (Capital Raise Window)` |
| 424B with no extracted size / coupon           | `{Company} - Stock Offering Filed (Dilution Ahead)`           |
| Form 425 / acquisition cue without parties/$   | `{Company} - Acquisition Announced (Deal in Play)`            |
| Item 1.01 / material agreement without parties | `{Company} - Partnership or Major Contract Announced`         |
| Partnership/collab cue without a named partner | `{Company} - Strategic Partnership Announced`                 |
| Regulatory row without approval/CRL/hold facts | `{Company} - Regulatory Action Update`                        |
| Clinical row without phase/endpoint            | `{Company} - Clinical Trial Results Update`                   |

**One separator only.** Use a single spaced hyphen (`-`) between company and event. Put any tagline in parentheses — never a second dash / em dash:

- Good: `Acme Corp - Delisting Risk (Stock Could Lose Its Listing)`
- Bad: `Acme Corp — Delisting Risk — Stock Could Lose Its Listing`
- Bad (legacy): `Acme Corp: Delisting Risk (Stock Could Lose Its Listing)`

Exceptions (no company/event hyphen; fixed product copy): FDA (`Receives FDA Approval!`). Acquisition announcements use the hyphen form `{Company} - Acquisition Announced (Deal in Play)`. Fact-rich capital / deal / clinical / partnership / regulatory titles from `subject-titles.ts` may also omit the single hyphen when they read as a natural sentence.

Macro titles with no issuer keep an em dash for the period only: `CPI — {Month Year}`, `Jobs Report (NFP) — {Month Year}`.

---

## Subject → title

| Subject                                              | Title format                                                                                                                                                                                                                           |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Earnings                                             | `{Company Name} - Earnings Report Qn` (Finnhub calendar + SEC Item 2.02; tape recomputes legacy rows)                                                                                                                                  |
| FDA Approval                                         | `{Company Name} Receives FDA Approval!` (thin); fact-rich → agency + product outcome via `subject-titles`                                                                                                                              |
| Halts                                                | `Halts ({Company Name}) - {reason}`                                                                                                                                                                                                    |
| Form 4 Buy                                           | `{Company Name} - Form 4 Insider Buy` (mixed → `{Company} - Form 4 Insider Buy & Sell`)                                                                                                                                                |
| Form 4 Sell                                          | `{Company Name} - Form 4 Insider Sell`                                                                                                                                                                                                 |
| 8-K Material agreement (1.01)                        | Thin: `{Company Name} - Partnership or Major Contract Announced`; partnership/collab facts → partnership voice; M&A facts → acquire/close/terminate                                                                                    |
| 8-K Agreement terminated (1.02)                      | `{Company Name} - Agreement Terminated`                                                                                                                                                                                                |
| 8-K M&A / acquisition closed (2.01)                  | Thin: `{Company Name} - Acquisition Closed`; fact-rich → `closes … acquisition`                                                                                                                                                        |
| 8-K Change of control (5.01)                         | `{Company Name} - Change of Control`                                                                                                                                                                                                   |
| 8-K Management (5.02)                                | `{Company Name} - {Position} Change ({Appointment\|Departure})` e.g. `Acme Corp - CEO Change (Departure)`                                                                                                                              |
| 8-K Capital / obligation (2.03, 3.02, …)             | Title Case item label, e.g. `{Company Name} - New Financial Obligation`                                                                                                                                                                |
| 8-K Bankruptcy (1.03)                                | `{Company Name} - Bankruptcy Filing (Equity at Risk)`                                                                                                                                                                                  |
| 8-K Delisting (3.01)                                 | `{Company Name} - Delisting Risk (Stock Could Lose Its Listing)`                                                                                                                                                                       |
| 8-K Distress (2.04, 2.06, 4.02, …)                   | Title Case item label, e.g. `{Company Name} - Debt Acceleration`                                                                                                                                                                       |
| 8-K Cyber (1.05)                                     | `{Company Name} - Material Cybersecurity Incident`                                                                                                                                                                                     |
| 8-K Restructuring (2.05)                             | `{Company Name} - Restructuring / Exit Costs`                                                                                                                                                                                          |
| 8-K Governance misc (4.01, 5.03, 5.04)               | Title Case item label, e.g. `{Company Name} - Auditor Change`                                                                                                                                                                          |
| 8-K Non-catalyst only (7.01 / 8.01 / 9.01 / routine) | Suppressed by quality gate (not on tape)                                                                                                                                                                                               |
| S-3                                                  | Thin: `{Company Name} - Shelf Registration Filed (Capital Raise Window)`; fact-rich: `{Company} files $XM shelf registration` / ATM program                                                                                            |
| 424B                                                 | Thin: `{Company Name} - Stock Offering Filed (Dilution Ahead)`; fact-rich: size / notes / structured coupon when extracted                                                                                                             |
| Acquisition Announcement (425)                       | `{Company Name} - Acquisition Announced (Deal in Play)`                                                                                                                                                                                |
| 13D                                                  | `{Company Name} - Schedule 13D`                                                                                                                                                                                                        |
| 13G                                                  | `{Company Name} - Schedule 13G`                                                                                                                                                                                                        |
| Clinical trials                                      | Thin: `{Company Name} - Clinical Trial Results Update`; fact-rich: Phase + endpoint/status via `subject-titles`                                                                                                                        |
| Regulatory (non-approval thin)                       | Thin: `{Company Name} - Regulatory Action Update`; approval → `{Company} Receives FDA Approval!` or agency+product via `subject-titles`                                                                                                |
| CPI                                                  | `CPI — {Month Year}`                                                                                                                                                                                                                   |
| Jobs / NFP                                           | `Jobs Report (NFP) — {Month Year}`                                                                                                                                                                                                     |
| FOMC                                                 | `FOMC Rate Decision`                                                                                                                                                                                                                   |
| Wire / news                                          | Story headline as-is (no `{Company} - {Event}` rewrite), except Seeking Alpha                                                                                                                                                          |
| Seeking Alpha                                        | `{Company} - {catalyst takeaway}` via `formatSeekingAlphaTitle` (upgrade/PT/earnings/FDA/offering/thesis); market-wide calendars stay event-only (no wrong ticker prefix). Publisher may be `Seeking Alpha` or Finnhub `SeekingAlpha`. |
| Analyst / price target                               | `{Company Name} - Price Target` / `{Company Name} - Analyst Rating`                                                                                                                                                                    |

---

## Ground-rule patterns (live formatters)

Implemented in `src/lib/catalysts/catalyst-titles.ts`:

| Pattern                                                       | Formatter                          |
| ------------------------------------------------------------- | ---------------------------------- |
| `Halts ({Company}) - {reason}`                                | `formatHaltTitle`                  |
| `{Company} Receives FDA Approval!`                            | `formatFdaApprovalTitle`           |
| `{Company} - Earnings Report Qn`                              | `formatEarningsReportTitle`        |
| Narrative 8-K (1.01 / 1.03 / 3.01 / 5.02)                     | `formatSec8kItemTitle` (+ helpers) |
| Other `{Company} - {8-K item label}`                          | `formatSec8kItemTitle`             |
| `{Company} - Form 4 Insider Buy/Sell/…`                       | `formatForm4InsiderTitle`          |
| `{Company} - Shelf Registration Filed (Capital Raise Window)` | `formatShelfRegistrationTitle`     |
| `{Company} - Stock Offering Filed (Dilution Ahead)`           | `formatProspectusOfferingTitle`    |
| `{Company} - Acquisition Announced (Deal in Play)`            | `format425MergerTitle`             |
| `{Company} - Acquisition Closed`                              | `formatAcquisitionClosedTitle`     |
| `{Company} - Strategic Partnership Announced`                 | `formatPartnershipTitle`           |
| `{Company} - Schedule 13D/G`                                  | `formatSchedule13DTitle` / `13G`   |
| `{Company} - Clinical Trial Results Update`                   | `formatClinicalTrialTitle`         |
| `{Company} - Regulatory Action Update`                        | `formatRegulatoryActionTitle`      |
| `CPI — {Month Year}`                                          | `formatCpiTitle`                   |
| `Jobs Report (NFP) — {Month Year}`                            | `formatJobsReportTitle`            |
| `FOMC Rate Decision`                                          | `formatFomcRateDecisionTitle`      |
| `{Company} - Price Target`                                    | `formatPriceTargetTitle`           |
| `{Company} - Analyst Rating`                                  | `formatAnalystRatingTitle`         |

Display preference / legacy rewrite: `titleLine` in `src/lib/catalysts/feed-display.ts` (rewrites double-dash / `{Event} - {Company}` / `{Company}: {Event}` legacy rows to the current ground-rule form, including `FDA Approval - {Company}` / `{Company}: FDA Approval` → `{Company} Receives FDA Approval!`).

---

## Ingest wiring (brief)

| Subject family                              | Fetch / normalize                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Halts                                       | `fetch-nasdaq-halts.ts` → `formatHaltTitle`                                                              |
| Earnings (calendar)                         | `fetch-finnhub-catalysts.ts` → `formatEarningsReportTitle`                                               |
| FDA                                         | `fetch-openfda.ts` / Finnhub FDA → `formatFdaApprovalTitle`                                              |
| 8-K / Form 4 / S-3 / 424B / 425 / 13D / 13G | `fetch-sec-edgar.ts` + `parse-8k-items.ts` / Form 4 enrich                                               |
| Clinical                                    | `fetch-clinicaltrials.ts` → `formatClinicalTrialTitle`                                                   |
| Macro (CPI / NFP / FOMC)                    | `fetch-macro-calendar.ts`                                                                                |
| Wire / news                                 | `fetch-polygon.ts` / Finnhub company news                                                                |
| Seeking Alpha                               | Same news paths when publisher/source is Seeking Alpha — title rewritten at ingest + `titleLine` display |
| Analyst / PT                                | `fetch-finnhub-catalysts.ts` (recommendation + price target)                                             |
