# SEC 8-K & Form 4 — subject classification for titles

**Audience:** Engineers wiring tape titles + quality gates  
**Purpose:** Simple, day-trader-oriented classification of 8-K Item codes and Form 4 transaction directions so each row can be titled by relevance/context.  
**Catalyst definition:** Material and actionable for day / event traders — not routine ownership paperwork or boilerplate disclosure.

---

## 1. Product rule

| Keep on tape                                                       | Drop / suppress                                             |
| ------------------------------------------------------------------ | ----------------------------------------------------------- |
| Material 8-K items (M&A, earnings, distress, capital, cyber, etc.) | 7.01 / 8.01 / 9.01-only filings                             |
| Open-market Form 4 **buy (P)** / **sell (S)** / mixed P+S          | Form 4 awards, tax withholding, gifts, exercises-only       |
| Halts, offerings (S-3/424B), activist 13D when they clear the gate | Mine safety, ethics code, routine votes / nominations alone |

Titles follow ground-rule patterns already used for earnings / FDA / halts, plus
company-first narrative copy for a few high-signal SEC subjects (see
[`FEED-TITLE-GUIDELINES.md`](./FEED-TITLE-GUIDELINES.md)):

- `Earnings Report Qn - {Company}`
- `Form 4 Insider Buy - {Company}`
- Narrative 8-K / 424B / 425 (company-first) where listed below
- Otherwise `{8-K item label} - {Company}`

---

## 2. 8-K Item catalog → title + catalyst class

| Item | Official theme (short)                         | Tape title pattern                                           | Class            | Notes                                   |
| ---- | ---------------------------------------------- | ------------------------------------------------------------ | ---------------- | --------------------------------------- |
| 1.01 | Entry into material agreement                  | `{Co} New Deal Announced — Major Contract or Partnership`    | **Catalyst**     | Contracts, partnerships                 |
| 1.02 | Termination of material agreement              | `Agreement Terminated - {Co}`                                | **Catalyst**     |                                         |
| 1.03 | Bankruptcy / receivership                      | `{Co} — Bankruptcy Filing — Equity at Risk`                  | **Catalyst**     | High urgency                            |
| 1.04 | Mine safety                                    | —                                                            | **Non-catalyst** | Statutory; drop when only item          |
| 1.05 | Material cybersecurity incident                | `Material Cybersecurity Incident - {Co}`                     | **Catalyst**     |                                         |
| 2.01 | Completion of acquisition/disposition          | `Acquisition / Disposition Closed - {Co}`                    | **Catalyst**     |                                         |
| 2.02 | Results of operations                          | `Earnings Report Qn - {Co}`                                  | **Catalyst**     | Quarter from Filed: / timestamp         |
| 2.03 | Creation of direct financial obligation        | `New Financial Obligation - {Co}`                            | **Catalyst**     |                                         |
| 2.04 | Triggering events that accelerate obligation   | `Debt Acceleration - {Co}`                                   | **Catalyst**     |                                         |
| 2.05 | Costs associated with exit/disposal            | `Restructuring / Exit Costs - {Co}`                          | **Catalyst**     |                                         |
| 2.06 | Material impairments                           | `Material Impairment - {Co}`                                 | **Catalyst**     |                                         |
| 3.01 | Notice of delisting / failure to satisfy       | `{Co} — Delisting Risk — Stock Could Lose Its Listing`       | **Catalyst**     |                                         |
| 3.02 | Unregistered sales of equity                   | `Unregistered Equity Sale - {Co}`                            | **Catalyst**     | Dilution                                |
| 3.03 | Material modification to rights                | `Security Holder Rights Change - {Co}`                       | **Catalyst**     |                                         |
| 4.01 | Changes in registrant’s certifying accountant  | `Auditor Change - {Co}`                                      | **Catalyst**     | Governance signal                       |
| 4.02 | Non-reliance on prior financials               | `Financials Non-Reliance - {Co}`                             | **Catalyst**     |                                         |
| 5.01 | Changes in control                             | `Change of Control - {Co}`                                   | **Catalyst**     |                                         |
| 5.02 | Departure/election of directors; officer appt. | `{Co} — Executive Change — CEO/CFO Departure or Appointment` | **Catalyst**     | C-suite moves matter                    |
| 5.03 | Amendments to articles/bylaws                  | `Charter / Bylaw Change - {Co}`                              | **Keep**         | Often procedural; keep if sole material |
| 5.04 | Temporary suspension of trading                | `Trading Blackout - {Co}`                                    | **Keep**         | Can precede news                        |
| 5.05 | Amendments to ethics code                      | —                                                            | **Non-catalyst** | Drop when only item                     |
| 5.07 | Submission of matters to a vote                | —                                                            | **Non-catalyst** | Routine annual / say-on-pay; drop alone |
| 5.08 | Shareholder nominations                        | —                                                            | **Non-catalyst** | Drop when only item                     |
| 7.01 | Regulation FD disclosure                       | —                                                            | **Non-catalyst** | Alone = noise (may pair with real item) |
| 8.01 | Other events                                   | —                                                            | **Non-catalyst** | Alone = noise without gold co-item      |
| 9.01 | Financial statements and exhibits              | —                                                            | **Non-catalyst** | Always rides along; never primary alone |

**Primary-item selection:** ignore 9.01 for headline choice; among remaining items pick highest `CATEGORY_PRIORITY`.  
**Quality gate:** drop filings whose item set is entirely in the non-catalyst set above (`7.01`, `8.01`, `9.01`, `1.04`, `5.05`, `5.07`, `5.08`).

Label source of truth in code: `ITEM_CATALOG` in `src/lib/jobs/parse-8k-items.ts`.  
Title formatter: `formatSec8kItemTitle` / `formatEarningsReportTitle` in `src/lib/catalysts/catalyst-titles.ts`.  
Non-8-K offering / M&A forms: `formatProspectusOfferingTitle` (424B), `format425MergerTitle` (425).

---

## 3. Form 4 transaction codes → title

| Code               | SEC meaning (typical)            | Desk class         | Title when dominant                                   |
| ------------------ | -------------------------------- | ------------------ | ----------------------------------------------------- |
| **P**              | Open-market purchase             | **Catalyst buy**   | `Form 4 Insider Buy - {Company}`                      |
| **S**              | Open-market sale                 | **Catalyst sell**  | `Form 4 Insider Sell - {Company}`                     |
| P+S                | Both in one filing               | **Catalyst mixed** | `Form 4 Insider Buy & Sell - {Company}`               |
| A                  | Grant / award                    | Routine            | Drop (`form4_routine`)                                |
| M                  | Option exercise                  | Routine            | Drop                                                  |
| F                  | Tax withholding                  | Routine            | Drop                                                  |
| G                  | Gift                             | Routine            | Drop                                                  |
| D/C/U/H/…          | Other dispositions / conversions | Routine            | Drop                                                  |
| Unknown / XML miss | Unenriched Atom row              | Soft-keep          | `Form 4 Insider Transaction - {Company}` until enrich |

Enrichment: EDGAR ownership XML → `insider_buy` / `insider_sell` / `form4_mixed` / `form4_routine` (`parse-form4.ts`).  
Quality gate drops only `form4_routine` (confirmed paperwork), not unenriched `form4` rows (fetch-cap soft-fail).

---

## 4. Examples (tape)

| Situation               | Title                                                             |
| ----------------------- | ----------------------------------------------------------------- |
| Item 2.02 filed mid-May | `Earnings Report Q2 - Apple Inc.`                                 |
| Item 1.01 only (+ 9.01) | `PEDEVCO CORP New Deal Announced — Major Contract or Partnership` |
| Item 1.03 bankruptcy    | `Acme Corp — Bankruptcy Filing — Equity at Risk`                  |
| Item 3.01 delisting     | `Quantum-Si Inc — Delisting Risk — Stock Could Lose Its Listing`  |
| Item 5.02 management    | `Acme Corp — Executive Change — CEO/CFO Departure or Appointment` |
| 424B prospectus         | `Acme Corp New Stock Offering Filed — Potential Dilution Ahead`   |
| Form 425                | `Acme Corp — Merger or Acquisition News: Deal in Play`            |
| Item 1.05 cybersecurity | `Material Cybersecurity Incident - CrowdStrike`                   |
| Form 4 code P           | `Form 4 Insider Buy - Tesla, Inc.`                                |
| Form 4 code S           | `Form 4 Insider Sell - Nvidia Corporation`                        |
| Form 4 codes P + S      | `Form 4 Insider Buy & Sell - Acme Corp`                           |
| Form 4 code F only      | _(suppressed — routine)_                                          |
| Items 7.01 + 9.01 only  | _(suppressed — boilerplate)_                                      |
| Items 5.07 + 9.01 only  | _(suppressed — routine vote)_                                     |

---

## 5. Wiring map

| Concern                  | Location                                             |
| ------------------------ | ---------------------------------------------------- |
| Item labels / categories | `src/lib/jobs/parse-8k-items.ts`                     |
| Form 4 P/S vs routine    | `src/lib/jobs/parse-form4.ts`                        |
| Quality drops            | `src/lib/catalysts/quality-gate.ts`                  |
| Title formatters         | `src/lib/catalysts/catalyst-titles.ts`               |
| SEC ingest titles        | `src/lib/jobs/fetch-sec-edgar.ts`                    |
| Tape display preference  | `src/lib/catalysts/feed-display.ts`                  |
| Cross-API near-dedupe    | `src/lib/jobs/dedupe-catalysts.ts` + ingest pipeline |
| Cluster → one feed row   | `cluster-events.ts` + `feed-query.ts` (primary only) |
