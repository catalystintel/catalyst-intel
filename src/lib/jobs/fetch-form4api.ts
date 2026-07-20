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
 */
export async function fetchForm4Api(): Promise<SourceFetchResult> {
  const apiKey = getForm4ApiKey();
  if (!apiKey) {
    return skippedSourceResult(
      "form4api",
      "FORM4_API_KEY is not set. Form 4 still ingests via SEC EDGAR; this API is optional enrichment.",
    );
  }

  // Form4API base URL — soft-fail on HTTP errors so missing/paid plans don't break cron.
  const res = await fetch("https://api.form4api.com/v1/filings?limit=25", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    // Soft-skip rather than hard-fail the orchestrator for optional paid API.
    return {
      ...skippedSourceResult(
        "form4api",
        `Form4API returned ${res.status}; skipping optional enrichment.`,
      ),
      configured: true,
      status: "skipped",
    };
  }

  const payload = (await res.json()) as {
    data?: Array<{
      id?: string;
      accession?: string;
      ticker?: string;
      company?: string;
      filedAt?: string;
      transactionType?: string;
      url?: string;
    }>;
  };

  const normalized: NormalizedCatalyst[] = [];
  for (const row of payload.data ?? []) {
    const id = row.id || row.accession;
    if (!id) continue;
    const ticker = row.ticker?.trim().toUpperCase() || null;
    const timestamp = row.filedAt
      ? new Date(row.filedAt).toISOString()
      : new Date().toISOString();

    normalized.push({
      provider: "form4api",
      externalId: `form4api:${id}`,
      url: row.url ?? null,
      rawContent: row,
      ticker,
      companyName: row.company?.trim() || ticker,
      type: "Form 4",
      title: `${ticker ?? row.company ?? "Issuer"} — Form 4`,
      headline: row.transactionType?.trim() || "Insider transaction",
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
