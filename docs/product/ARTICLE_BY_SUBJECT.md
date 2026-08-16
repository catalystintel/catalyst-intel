# Article by subject

Classify the catalyst into one of the 17 subjects first. Then write **title** and **content** for that subject.

## Title craft (all subjects)

- **One job:** say what happened and to whom in one glance. Prefer a grounded sentence when facts exist; use a professional thin fallback when they do not.
- **Never invent** dollars, parties, phases, approvals, or outcomes. Omit a slot when the source does not state it.
- **Fact-rich beats chips.** A specific vendor/filing headline or extracted-fact sentence wins over taxonomy labels (`Shelf registration (S-3)`, `Clinical trial`, `8-K filing`).
- **Professional thin beats stiff legacy.** Prefer `{Company} - Shelf Registration Filed (Capital Raise Window)` over `files shelf registration (S-3)` / AccNo-thin chips — still no invented size.
- **Vary voice by subject** so the tape does not read as cookie-cutter `{Company} - {Subject}` for every row.
- **Keep feed taxonomy / chips as-is** (including Capital Markets on the feed). These rules are **titles only**.

**Automation:** For **financing / M&A / partnership / regulatory / clinical**, titles go through the subject-case engine (`subject-case-titles.ts`): identify primary subject → select case (F1–F6, M1–M20, P1–P6, R1–R7, C1–C7) → fill only that template with verified facts. Other subjects keep builders in `subject-titles.ts`. Display path: `titleLine` in `feed-display.ts`. Never invent numbers.

**Primary vs secondary:** e.g. FDA approval after Phase 3 → **regulatory** title (clinical is secondary). Partnership to develop a drug → **partnership**, not clinical.

**Content:** **3–6 short lines** of grounded detail from the real article/filing only — never invent numbers or facts. Lead with why it matters, then the subject’s fact slots below (omit a slot when the source does not state it).

Subjects: `src/lib/catalysts/taxonomy.ts`.

---

## `earnings`

**Title voice:** EPS / revenue / guidance outcome when known (e.g. beat/miss vs estimate); else a clear earnings report line with quarter when known — not the same hyphen template every time.

**Content (3–6 lines):** Why it matters. EPS vs estimate. Revenue vs estimate. Guidance if stated. One other material number or note if present.

## `deals`

**Title voice:** Buyer / target / value / status in natural deal language when known (announce, close, terminate). Prefer outcome verbs (`to acquire`, `closes`, `terminates`) over identical deal chips when the extract already names parties or dollars.

### Preferred patterns (M&A)

Titles use the subject-case engine (`M1`–`M20`). **Buyer** = acquirer (fact or listing company). **Target** = acquired company. **$X** / **$/Share** / **% premium** only when the source states them — never invent.

| Facts / cue                  | Pattern                                                             |
| ---------------------------- | ------------------------------------------------------------------- |
| Agrees + target + value      | `{Buyer} Agrees to Acquire {Target} for {Value}`                    |
| Target + $/share             | `{Buyer} to Acquire {Target} for {$}/Share`                         |
| Target + value (announce/to) | `{Buyer} to Acquire {Target} in {Value} Deal`                       |
| Target only                  | `{Buyer} Announces Acquisition of {Target}`                         |
| Agrees + target              | `{Buyer} Agrees to Acquire {Target}`                                |
| Closed + target              | `{Buyer} Completes Acquisition of {Target}`                         |
| Merger                       | `{Buyer} Agrees to Merge With {Target}`                             |
| Proposal / LOI               | `{Buyer} Proposes Acquisition of {Target}`                          |
| Exploring                    | `{Buyer} Explores Acquisition of {Target}`                          |
| Takeover + $/share           | `{Buyer} Launches Takeover of {Target} for {$}/Share`               |
| Asset + value                | `{Buyer} to Acquire {Asset} for {Value}` / `Acquires {Asset} for …` |
| Definitive agreement         | `{Buyer} Enters Definitive Agreement to Acquire {Target}`           |
| Agrees to buy + $/share      | `{Buyer} Agrees to Buy {Target} for {$}/Share`                      |
| All-stock / cash-and-stock   | `{Buyer} to Acquire {Target} in All-Stock Deal` (or Cash-and-Stock) |
| Premium %                    | `{Buyer} Agrees to Acquire {Target} at {X}% Premium`                |
| Completes + value + target   | `{Buyer} Completes {Value} Acquisition of {Target}`                 |
| Announces + value + target   | `{Buyer} Announces {Value} Acquisition of {Target}`                 |
| Terminated                   | `{Buyer} Terminates Acquisition of {Target}`                        |
| Thin                         | `{Buyer} - Acquisition Announced (Deal in Play)`                    |

**Good:** `Acme Agrees to Acquire Rival for $2.0B` · `Acme Completes $2.0B Acquisition of Rival`  
**Bad:** inventing a deal value · forcing acquisition wording onto a collab filing

### Partnership voice (still `deals` taxonomy)

When facts or filing text say partnership / collaboration / license — not M&A — use a distinct partnership line.

| Facts known                | Pattern                                          |
| -------------------------- | ------------------------------------------------ |
| Partner + nature           | `{Company} partners with {Partner} — {nature}`   |
| License + asset + partner  | `{Company} licenses {Asset} to {Partner}`        |
| Partner only               | `{Company} announces partnership with {Partner}` |
| Thin / type-word “partner” | `{Company} - Strategic Partnership Announced`    |

Reject partner values that are type words (`partnership`, `collaboration`, `license`, etc.). Treat `strategic partnership` as a generic nature → thin fallback.

**Content (3–6 lines):** Why it matters. Parties. Deal value or structure. Status. Timing if stated.

## `management`

**Title voice:** Who / role / appointment or departure when known. Prefer named officer + action over a generic “Executive Change” label.

**Content (3–6 lines):** Why it matters. Who. Role. Appointment or departure. Effective date or interim if known.

## `capital`

**Title voice:** Capital-markets instrument + size when known (shelf, ATM, equity offering, notes). Company-first plain English — not a form-code chip like `{Company} - Shelf Registration (S-3)` when dollars or facility type exist. Never invent size; omit dollars when absent.

### Preferred patterns

| Facts known               | Pattern                                                       |
| ------------------------- | ------------------------------------------------------------- |
| Shelf + amount            | `{Company} files $500M shelf registration`                    |
| ATM + amount              | `{Company} sets up $100M at-the-market (ATM) program`         |
| Equity offering + amount  | `{Company} files $250M equity offering`                       |
| Structured notes + coupon | `{Company} prices structured notes · 5.25%`                   |
| Thin S-3                  | `{Company} - Shelf Registration Filed (Capital Raise Window)` |
| Thin 424B                 | `{Company} - Stock Offering Filed (Dilution Ahead)`           |

**Good:** `Acme files $500M shelf registration` · `Acme - Stock Offering Filed (Dilution Ahead)`  
**Bad:** inventing `$500M` on a thin S-3 · leaving AccNo / “Shelf registration (S-3)” as the tape title when a professional thin voice exists

**Content (3–6 lines):** Why it matters. Instrument. Size. Dilution or leverage stake. Use of proceeds if stated.

## `distress`

**Title voice:** Bankruptcy, delisting, or covenant stress labeled clearly with equity / listing risk when known.

**Content (3–6 lines):** Why it matters. Event type. Amount or covenant if any. Deadline or next step. Equity or listing risk.

## `restructuring`

**Title voice:** Charge, headcount, or exit costs when known — distinct from generic distress wording.

**Content (3–6 lines):** Why it matters. Charge size. Headcount or sites. Expected savings. Timing if stated.

## `governance`

**Title voice:** Plain event (auditor change, change of control, etc.) with company context — not a bare item code.

**Content (3–6 lines):** Why it matters. What changed. Who or body affected. Effective date. Vote result if any.

## `disclosure`

**Title voice:** Plain English event from the extract. Drop if boilerplate only.

**Content (3–6 lines):** Why it matters. Only real disclosed facts. No AccNo or empty “8-K filing” filler.

## `trading_halt`

**Title voice:** Halt / resume plus reason in plain English (product may keep the `Halts (…)` pattern — it is already distinct from other subjects).

**Content (3–6 lines):** Why it matters. Halted or resumed. Reason in plain English. Exchange / time. Resume time if known.

## `insider`

**Title voice:** Buy or sell, role / shares when known — not every row as identical “Form 4 Insider …” copy.

**Content (3–6 lines):** Why it matters. Buy or sell. Insider and role. Shares or dollars. Ownership after if known.

## `regulatory`

**Title voice:** Agency + action + product/indication when known (approval, CRL, clinical hold, clearance). Excitement (`Receives FDA Approval!`) only when the source is a clear approval — never invent approval from a thin regulatory row.

### Preferred patterns

| Facts known             | Pattern                                       |
| ----------------------- | --------------------------------------------- |
| Approval + product      | `{Company} wins FDA approval for {Product}`   |
| CRL + product           | `{Company} receives FDA CRL for {Product}`    |
| Clinical hold + product | `{Company} {Product} placed on clinical hold` |
| Clear approval, thin    | `{Company} Receives FDA Approval!`            |
| Non-approval thin       | `{Company} - Regulatory Action Update`        |

**Good:** `Acme wins FDA approval for DrugX` · `Acme - Regulatory Action Update`  
**Bad:** inventing `Receives FDA Approval!` from a generic 8-K regulatory mention

**Content (3–6 lines):** Why it matters. Agency action. Product or indication. Outcome. Next milestone if stated.

## `clinical`

**Title voice:** Phase + result/status in study language when known; prefer primary-endpoint outcome phrasing over a blank “Clinical Trial” chip.

### Preferred patterns

| Facts known                     | Pattern                                                         |
| ------------------------------- | --------------------------------------------------------------- |
| Phase + met primary + condition | `{Company} Phase 3 trial meets primary endpoint in {Condition}` |
| Phase + missed primary          | `{Company} Phase 2 trial misses primary endpoint`               |
| Phase only                      | `{Company} Phase 2 clinical trial update`                       |
| Thin / no phase                 | `{Company} - Clinical Trial Results Update`                     |

**Good:** `BioCo Phase 3 trial meets primary endpoint in NSCLC` · `BioCo - Clinical Trial Results Update`  
**Bad:** inventing endpoint success · leaving a bare `Clinical Trial` taxonomy chip as the title

**Content (3–6 lines):** Why it matters. Phase. Status or result. Condition. Primary endpoint if present.

## `macro`

**Title voice:** Print name + period (CPI, Jobs/NFP, FOMC) — already a distinct macro voice; add the print when known.

**Content (3–6 lines):** Why it matters. Actual vs estimate. Prior. One key component. Decision or rate if FOMC.

## `analyst`

**Title voice:** Firm / upgrade-downgrade / PT when known. Prefer Street headline detail over a blank “Price Target” chip.

**Content (3–6 lines):** Why it matters. Firm. Action. Rating change. Price-target change. Thesis only if in the source.

## `cyber`

**Title voice:** Material incident wording distinct from generic disclosure — say cybersecurity when the filing does.

**Content (3–6 lines):** Why it matters. Incident type. What was affected. Disclosed impact. Timing if stated.

## `news`

**Title voice:** Clean headline as-is; Seeking Alpha → company + catalyst takeaway; if reclassified, use that subject’s voice. Drop thin firehose rows.

**Content (3–6 lines):** Why it matters. 2–5 grounded facts from the story.

## `other`

**Title voice:** Reclassify if possible; else plain English event with company. Drop junk-drawer rows without facts.

**Content (3–6 lines):** Only if real facts exist. Same bar as disclosure.
