import {
  ingestNormalizedCatalysts,
  toSourceResult,
  type NormalizedCatalyst,
  type SourceFetchResult,
} from "@/lib/jobs/ingest-pipeline";

/**
 * openFDA recent drug approvals / application events (free, no key required
 * for modest rate limits). Soft network failures bubble to the orchestrator.
 */
export async function fetchOpenFda(): Promise<SourceFetchResult> {
  const url =
    "https://api.fda.gov/drug/drugsfda.json?search=submissions.submission_status:AP&limit=25";

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    throw new Error(`openFDA failed (${res.status}): ${res.statusText}`);
  }

  const payload = (await res.json()) as {
    results?: Array<{
      application_number?: string;
      sponsor_name?: string;
      products?: Array<{ brand_name?: string; active_ingredients?: unknown }>;
      submissions?: Array<{
        submission_status_date?: string;
        submission_type?: string;
        submission_status?: string;
      }>;
      openfda?: { brand_name?: string[]; generic_name?: string[] };
    }>;
  };

  const normalized: NormalizedCatalyst[] = [];

  for (const row of payload.results ?? []) {
    const app = row.application_number?.trim();
    if (!app) continue;

    const brand =
      row.openfda?.brand_name?.[0] ||
      row.products?.[0]?.brand_name ||
      "Drug approval";
    const sponsor = row.sponsor_name?.trim() || null;
    const submission = row.submissions?.[0];
    const date =
      submission?.submission_status_date?.trim() ||
      new Date().toISOString().slice(0, 10);

    normalized.push({
      provider: "openfda",
      externalId: `openfda:${app}:${date}`,
      url: `https://api.fda.gov/drug/drugsfda.json?search=application_number:"${app}"`,
      rawContent: row,
      ticker: null,
      companyName: sponsor,
      type: "FDA Approval",
      title: `${sponsor ?? "Sponsor"} — ${brand}`,
      headline: "FDA drug approval",
      eventCategory: "regulatory",
      subcategory: "openfda_approval",
      timestamp: new Date(`${date}T12:00:00.000Z`).toISOString(),
      summary: [
        submission?.submission_type,
        submission?.submission_status,
        brand,
      ]
        .filter(Boolean)
        .join(" · "),
      confidence: 70,
      tags: ["openfda", "fda", "approval"],
    });
  }

  const result = await ingestNormalizedCatalysts(normalized, { purge: false });
  return toSourceResult("openfda", result);
}
