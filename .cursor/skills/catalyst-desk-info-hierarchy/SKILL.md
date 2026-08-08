---
name: catalyst-desk-info-hierarchy
description: >-
  Catalyst Intel desk content and click hierarchy (row → split → details),
  enrich-in-place (no cross-vendor event joins for body), SEC primary-doc
  content bar, and AI triage role. Use whenever changing feed rows, split view,
  details view, ingest enrichment, takeaways/WIIM, AI analysis, or deciding
  what data an event must show.
---

# Catalyst desk info hierarchy

## Product mindset (always)

Minimize clicks. Maximize investor-usable info at each step.

- so the row is clear without clicking anything.
- though clicking it and seeing the splitview gives the actual takeaways, and summary of whats happened so thats enough for investor
- details -> get the fuller event story (only if user is interested)

Benzinga Pro (and similar) are **reference for information density and WIIM-style causality**, not chrome to clone. Borrow the job (fast Act/Dismiss), not their UI.

## Layer contract

| Layer        | Job                 | Must show                                                                                              | Must not                                                                     |
| ------------ | ------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| **Tape row** | Scan without click  | Clear title (plain English), symbol, category, time, materiality cue                                   | AccNo/Size, form jargon alone, empty “filing” labels                         |
| **Split**    | Enough to decide    | WIIM one-liner, **takeaways**, **keyFacts** (3–6), short summary of what happened, quote/Δ, proof link | AccNo as body; “go read the filing” without numbers                          |
| **Details**  | Deep dive if needed | Split content + plain-text snippets, detail cards, items, optional AI, proof meta                      | Fake article from Atom AccNo; rendered HTML filings; impact score; tag chips |

**AccNo / Size / Filed** = proof metadata only — never the event body.

## Enrichment policy (content)

- **One event = one vendor row.** Enrich **in place** with extra API calls on that identity (e.g. SEC accession → index + primary doc / Form 4 XML / EX-99).
- **Do not** merge same-symbol / same-window rows into one “story” for body. Proximity ≠ same event.
- Optional PR-wire match only as a **fallback for the same disclosure** (e.g. issuer press that is the exhibit), never as “busy name → join everything.”
- Prefer **collecting more from this filing** over adding sources that only add empty rows.

## SEC EDGAR (majority of tape)

Atom is discovery, not content. Before calling a SEC row “details-ready”:

1. Fetch primary document (and Form 4 ownership XML when form=4).
2. Extract plain-text **keyFacts**, **snippets**, investor summary, title overrides when facts exist.
3. Bind Split/Details to extract — never AccNo blob.
4. Form-type **plain-English blurbs** (e.g. 424B2 structured note ≠ generic “new stock / dilution” unless equity facts say so).

Discovery catch-up (Atom pagination / daily-index) is separate from content enrich.

## AI analysis role

On-demand **grounded triage**, not prediction:

- Input: only persisted fields for **this** event (title, summary, items, truncated body/extract, optional session %).
- Output: 2–3 short bullets + lean (bullish / bearish / neutral / uncertain).
- Must not invent numbers, coupons, or outcomes not in the text.
- Runs once per event; shared with all viewers.
- If body is AccNo-thin, AI cannot rescue the product — enrich first.
- After enrich exists, AI may **explain jargon in plain English** using extracted facts (still no speculation).
- UX: no “one-time compute” production copy; calm unavailable state on 429/errors; ⓘ explains the section.

## When implementing UI or ingest

1. Ask which layer you are changing (row / split / details) and whether it reduces clicks.
2. Prefer keyFacts + takeaways in **split** so Details is optional.
3. Do not ship titles/takeaways that tell users to read terms we did not extract.
4. Keep proof (EDGAR link) one click away but secondary to meaning.
5. User-facing copy says **Details**, never “full article” — this is an elaborated event view, not a news article.
