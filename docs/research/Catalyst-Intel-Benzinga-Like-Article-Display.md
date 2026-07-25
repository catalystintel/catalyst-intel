# Catalyst Intel — Benzinga-like Article Display Recommendations

**Scope:** Research + UX recommendations only (no app implementation).  
**Target surface:** In-app Read / article view at `/dashboard/catalyst/[id]`  
**Visual direction:** Keep Catalyst’s B&W mono trading desk; borrow Benzinga Pro _information architecture_, not their green/red chrome overload.

---

## 1. What Benzinga Pro actually does

Benzinga Pro is a **dense terminal**, not a magazine. News is optimized for scan → decide → act.

### Feed / list patterns

| Pattern               | How it shows up                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Symbol-first rows     | Symbol is the primary visual anchor; headline secondary                                  |
| Red/green symbols     | Up/down vs prior close (and sentiment cues)                                              |
| Source on the margin  | Source/category visible at a glance; color-codeable                                      |
| Hover affordances     | Mini-chart (“change since publish”), copy / share / open                                 |
| Category highlighting | Color-coded Hot / Earnings / Filings without filtering them out                          |
| Beats/Misses emphasis | Semantic highlight of _Beats_ / _Misses_ words + icons on dual beat/miss                 |
| Density over imagery  | Feed is text/data dense; images exist in API/content but Pro UI is not hero-photo driven |

### Opened article / detail patterns

| Pattern                         | How it shows up                                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Enhanced article details        | When a post opens: **symbols + summary** enriched (v1.62+)                                                           |
| WIIM (“Why Is It Moving?”)      | One-sentence cause of the move; also in Details                                                                      |
| Multi-symbol association        | Articles carry a list of related symbols                                                                             |
| Teaser → body                   | Short abstract/teaser, then full body                                                                                |
| Featured images (content model) | `thumb` / `small` / `large` image variants in news payload — useful for public articles; Pro itself stays desk-dense |
| Linked Details panel            | Click symbol → research panel (quote, chart, calendar, financials)                                                   |
| Squawk / alerts                 | Audio + pop-up / sound / TTS for hands-free monitoring                                                               |

**Bottom line:** Benzinga wins on _scannability and catalyst causality_, not on editorial layout.

---

## 2. Catalyst Intel today (`CatalystArticleView`)

Current Read view is already closer to a desk than a blog:

1. Back to Live tape
2. **Large symbol** + category + materiality badges
3. Headline + company
4. Meta grid: Provider / Category / Type / Time
5. CTAs: Open in Catalyst / original source
6. **Summary** (paragraph)
7. **Detail** cards (earnings fields when available)
8. **Article body** (bordered text panel)
9. Filing items + tags

**Strengths:** B&W mono desk voice; symbol-first header; summary → detail → body stack; materiality badge.  
**Gaps vs Benzinga-style trade UX:**

- No multi-symbol / related-symbol chips
- No one-line “why it’s moving” (WIIM equivalent) above the long summary
- No compact price-reaction / change-since-publish cue
- No semantic Beats/Misses (or catalyst-keyphrase) highlighting in body
- No optional source thumbnail (Benzinga content has images; Catalyst is text-only)
- Meta is informative but not “margin source + urgency” scannable like Pro
- Density is good; hierarchy could be sharper for 3-second triage

---

## 3. What to mirror (and what not to)

### Mirror

- Symbol-first hierarchy
- One-sentence catalyst thesis (WIIM-like)
- Related symbols as chips
- Summary as **bullets**, not only prose
- Semantic highlights for earnings outcomes / key catalyst phrases
- Optional compact media (thumb), never a full-bleed magazine hero
- Quick actions (copy headline, open source) near the header

### Do **not** mirror

- Loud green/red UI chrome everywhere (clash with B&W desk)
- Squawk audio as a v1 Read requirement
- Multi-panel workspace chrome inside the article page
- Magazine hero + overlay badges

**Accent rule:** Keep B&W; reserve a single accent only for live/material signals and Beats/Misses words.

---

## 4. Five concrete display ideas for Catalyst Read

### 1) Related symbol chip row (Benzinga multi-symbol)

Under the primary symbol, show related symbols as outlined mono chips (`AVGO`, `TSM`, …). Primary symbol stays large; related chips are secondary and tappable to that company’s latest catalyst or quote stub.

### 2) WIIM-style one-liner above Summary

A single bordered strip:  
`WHY IT'S MOVING · Beats EPS & revenue; FY guidance raised`  
This is the fastest Benzinga-like win — traders get causality before the long summary.

### 3) Bullet Summary + Detail grid (teaser → facts)

Keep Summary, but prefer **3 short bullets** (takeaways). Keep/expand Detail as a compact 2-column key/value grid (EPS, revenue, guidance, item codes). Matches Benzinga’s “summary data when opened” enrichment without magazine fluff.

### 4) Semantic Beats / Misses (and keyphrase) highlights

In Detail values and Article body, highlight outcome words (_Beats_ / _Misses_) and optionally catalyst verbs (_raises_, _halts_, _approves_). Use minimal accent only on those tokens — not full-row coloring.

### 5) Compact source thumb + reaction strip (not a hero image)

Optional ~180px source still under the meta strip (when an image/logo exists). Beside or below it, a thin **reaction** line: `Δ since publish · +2.4%` (when price data exists). This copies Benzinga’s “change since publish” idea without hover-only charts on mobile.

---

## 5. Recommended Read layout (sketch target)

```
← Live tape                              In-app article
─────────────────────────────────────────────────────
NVDA   [AVGO] [TSM] [AMD]    Earnings · HIGH
Headline…
Company name

┌ WHY IT'S MOVING · one sentence ───────────────────┐
└───────────────────────────────────────────────────┘

Provider · Category · Type · Time          [Source]
[thumb 16:9]     Δ since publish · +2.4%

SUMMARY
• bullet
• bullet
• bullet

DETAIL
EPS … | Rev … | Guidance …

ARTICLE BODY
(text with Beats/Misses highlights)

Filing items · Tags
```

Sketch: `Catalyst-Intel-Article-Display-Sketch.png` (same Downloads folder).

---

## 6. Priority if you implement later

| Priority | Idea                    | Why                                                    |
| -------- | ----------------------- | ------------------------------------------------------ |
| P0       | WIIM one-liner          | Biggest triage upgrade; fits existing summary pipeline |
| P0       | Bullet summary          | Matches trader scan behavior; low design risk          |
| P1       | Related symbol chips    | Benzinga parity; needs related-symbol data             |
| P1       | Beats/Misses highlights | Already aligned with earnings Detail cards             |
| P2       | Thumb + Δ since publish | Needs media + quote data; keep non-hero                |

---

## Sources (research)

- [Benzinga Pro Newsfeed feature](https://www.benzinga.com/pro/feature/newsfeed) — WIIM, filters, notifications
- [Getting Started: Newsfeed (Help)](https://help.benzinga.com/en/articles/1413278-getting-started-newsfeed) — symbol colors, hover actions, post appearance
- [Beats/Misses Highlighting (Help)](https://help.benzinga.com/en/articles/6843200-beats-misses-highlighting)
- [Benzinga Pro changelog v1.62](https://headwayapp.co/benzinga-pro-changes/version-1-62-0-has-been-deployed!-289809) — enhanced article details (symbols + summary)
- [Liberated Stock Trader review](https://www.liberatedstocktrader.com/benzinga-pro-review-real-time-news/) — sentiment symbols, change-since-publish mini-chart, squawk
- [StockChartPro review](https://www.stockchartpro.com/benzinga-review/) — feed screenshots, category color-coding, alerts
- [Benzinga News API model](https://www.benzinga.com/apis/blog/mastering-the-benzinga-newsfeed-api/) — teaser, body, image sizes, stocks[]
- Catalyst code: `src/components/catalyst-article-view.tsx`, `src/app/dashboard/catalyst/[id]/page.tsx`
