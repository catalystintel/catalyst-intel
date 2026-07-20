import {
  ingestNormalizedCatalysts,
  skippedSourceResult,
  toSourceResult,
  type NormalizedCatalyst,
  type SourceFetchResult,
} from "@/lib/jobs/ingest-pipeline";
import { getForm4ApiKey } from "@/lib/jobs/vendor-env";

/**
 * Optional Form4API enrichment when FORM4_API_KEY is set.
 * Primary Form 4 coverage still comes from SEC EDGAR Atom (type=4).
 * Soft-fails without a key.
 *
 * Auth is `X-Api-Key` (not Bearer). Free tier: https://www.form4api.com
 */
export async function fetchForm4Api(): Promise<SourceFetchResult> {
  const apiKey = getForm4ApiKey();
  if (!apiKey) {
    return skippedSourceResult(
      "form4api",
      "FORM4_API_KEY is not set. Form 4 still ingests via SEC EDGAR; this API is optional enrichment.",
    );
  }

  // Soft-fail on HTTP errors so missing/paid plans don't break cron.
  const res = await fetch(
    "https://api.form4api.com/v1/filings/recent?per_page=25",
    {
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    },
  );

  if (!res.ok) {
    return {
      ...skippedSourceResult(
        "form4api",
        `Form4API returned ${res.status}; skipping optional enrichment.`,
      ),
      configured: true,
      status: "skipped",
    };
  }

  type Form4Row = {
    id?: string;
    accession?: string;
    accessionNumber?: string;
    ticker?: string;
    companyTicker?: string;
    company?: string;
    companyName?: string;
    filedAt?: string;
    transactionType?: string;
    amendmentType?: string;
    url?: string;
  };

  const payload = (await res.json()) as Form4Row[] | { data?: Form4Row[] };
  const rows = Array.isArray(payload) ? payload : (payload.data ?? []);
  const normalized: NormalizedCatalyst[] = [];

  for (const row of rows) {
    const id = row.accessionNumber || row.accession || row.id;
    if (!id) continue;

    const ticker =
      (row.companyTicker || row.ticker)?.trim().toUpperCase() || null;
    const company = row.companyName?.trim() || row.company?.trim() || ticker;
    const timestamp = row.filedAt
      ? new Date(row.filedAt).toISOString()
      : new Date().toISOString();
    const headline =
      row.amendmentType?.trim() ||
      row.transactionType?.trim() ||
      "Insider filing";

    normalized.push({
      provider: "form4api",
      externalId: `form4api:${id}`,
      url: row.url ?? null,
      rawContent: row,
      ticker,
      companyName: company,
      type: "Form 4",
      title: `${ticker ?? company ?? "Issuer"} — Form 4`,
      headline,
      eventCategory: "insider",
      subcategory: "form4api",
      timestamp,
      confidence: 80,
      tags: ["form4", "insider", "form4api"],
    });
  }

  const result = await ingestNormalizedCatalysts(normalized, { purge: false });
  return toSourceResult("form4api", result);
}
