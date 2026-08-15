# Article by subject

Classify the catalyst into one of the 17 subjects first. Then write **title** and **content** for that subject.

**Titles:** Interesting, clear, professional — include company / outcome / real article details when known. Vary voice by subject so the tape does not read as cookie-cutter `{Company} - {Subject}` for every row. Prefer a specific vendor or filing headline when it already says what happened; use ground-rule fallbacks only when the stored title is a taxonomy chip or AccNo-thin.

**Automation:** `src/lib/catalysts/subject-titles.ts` (`buildSubjectTitle` / `preferSubjectTitle`) composes titles from extracted `keyFacts` on the enrich + display path (`titleLine` in `feed-display.ts`). SEC extract / Form 4 persist fact-rich `titleOverride`s when dollars, stakes, insider names, etc. are present. Never invent numbers — only extracted facts.

**Content:** **3–6 short lines** of grounded detail from the real article/filing only — never invent numbers or facts. Lead with why it matters, then the subject’s fact slots below (omit a slot when the source does not state it).

Subjects: `src/lib/catalysts/taxonomy.ts`.

---

## `earnings`

**Title voice:** EPS / revenue / guidance outcome when known (e.g. beat/miss vs estimate); else a clear earnings report line with quarter when known — not the same hyphen template every time.

**Content (3–6 lines):** Why it matters. EPS vs estimate. Revenue vs estimate. Guidance if stated. One other material number or note if present.

## `deals`

**Title voice:** Buyer / target / value / status in natural deal language when known (announce, close, terminate). Avoid identical “New Deal Announced” wording when the extract already names parties.

**Content (3–6 lines):** Why it matters. Parties. Deal value or structure. Status. Timing if stated.

## `management`

**Title voice:** Who / role / appointment or departure when known. Prefer named officer + action over a generic “Executive Change” label.

**Content (3–6 lines):** Why it matters. Who. Role. Appointment or departure. Effective date or interim if known.

## `capital`

**Title voice:** Instrument + size when known (offering, notes, shelf). Sound like capital markets, not a form-code chip.

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

**Title voice:** Agency action + outcome (approval, CRL, hold, etc.). Excitement only when the source is a clear approval.

**Content (3–6 lines):** Why it matters. Agency action. Product or indication. Outcome. Next milestone if stated.

## `clinical`

**Title voice:** Phase / result / status when known; prefer study outcome language over a blank “Clinical Trial” chip.

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
