# Internal article view vs old external-only links

Date: 2026-07-22
Feature branch: feat/internal-article-view
Route: /dashboard/catalyst/[id]

## What changed

Previously, Live tape Proof (and similar) opened the vendor URL in a new browser tab (SEC EDGAR, Benzinga/Polygon, Finnhub, etc.). There was no in-app place to read the catalyst as an article.

Now:

1. Clicking a feed Title row or Read opens an internal article page inside Catalyst (/dashboard/catalyst/{id}).
2. That page shows title, symbol, category/subcategory, source, time·date, a Summary, and best-available article body from stored ingest payload (raw_sources.raw_content + catalysts.summary).
3. Original on SEC/source remains a secondary external link (proof / full vendor page).
4. We do not iframe arbitrary news sites. If only a URL exists with no stored text, the page shows title/summary fallback and points you to the original.

## Summary behavior

- Prefer stored catalysts.summary (vendor snippet filled at ingest).
- If empty/weak, build a short extractive 2-3 sentence summary from stored body/title until Groq is wired.
- Ingest pipeline now calls ensureIngestSummary so new rows are less likely to land with a null summary (e.g. Form4API).

## What each source fills today

| Source               | Summary / body text                             | Original URL                 |
| -------------------- | ----------------------------------------------- | ---------------------------- |
| SEC EDGAR            | Atom filing abstract (item text), stripped HTML | Accession / filing link      |
| Nasdaq Halts         | RSS description                                 | Halt notice link             |
| Finnhub news         | API summary                                     | Article URL                  |
| Finnhub earnings/FDA | Calendar fields joined                          | Quote / FDA URL when present |
| Polygon / Benzinga   | description                                     | article_url                  |
| openFDA              | Sponsor / brand / submission fields             | openFDA search URL           |
| ClinicalTrials       | Brief title + status + conditions               | study URL                    |
| Form4API             | Transaction / company / filedAt                 | Filing URL                   |

Full HTML article scrape is intentionally out of scope for this pass (robots/ToS); we surface vendor-provided text already in the JSON/Atom payload.
