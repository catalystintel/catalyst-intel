import {
  ingestNormalizedCatalysts,
  toSourceResult,
  type NormalizedCatalyst,
  type SourceFetchResult,
} from "@/lib/jobs/ingest-pipeline";

/**
 * openFDA returns submission_status_date as YYYYMMDD (e.g. "20241023").
 * Also accepts YYYY-MM-DD. Returns ISO date (YYYY-MM-DD) or null.
 */
export function parseOpenFdaDate(
  raw: string | undefined | null,
): string | null {
  const value = raw?.trim();
  if (!value) return null;

  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toIsoTimestamp(dateYmd: string): string {
  const iso = new Date(`${dateYmd}T12:00:00.000Z`);
  if (Number.isNaN(iso.getTime())) {
    return new Date().toISOString();
  }
  return iso.toISOString();
}

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
      parseOpenFdaDate(submission?.submission_status_date) ||
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
      timestamp: toIsoTimestamp(date),
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
