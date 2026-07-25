import {
  formatFdaApprovalTitle,
  resolveDisplayCompanyName,
} from "@/lib/catalysts/catalyst-titles";
import { resolveSymbolFromName } from "@/lib/catalysts/symbol-resolver";
import { RETENTION_DAYS } from "@/lib/jobs/data-retention";
import {
  ingestNormalizedCatalysts,
  toSourceResult,
  type NormalizedCatalyst,
  type SourceFetchResult,
} from "@/lib/jobs/ingest-pipeline";

export interface OpenFdaSubmission {
  submission_status_date?: string;
  submission_type?: string;
  submission_status?: string;
  submission_class_code?: string;
  submission_class_code_description?: string;
}

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

function yyyymmdd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function retentionWindowStart(now: Date = new Date()): string {
  const start = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return yyyymmdd(start);
}

/**
 * Among AP submissions inside the retention window, prefer the newest
 * status date (live tape), breaking ties toward ORIG (true approvals).
 */
export function pickRecentApprovedSubmission(
  submissions: OpenFdaSubmission[] | undefined,
  options?: { now?: Date; retentionDays?: number },
): { submission: OpenFdaSubmission; dateYmd: string } | null {
  const now = options?.now ?? new Date();
  const retentionDays = options?.retentionDays ?? RETENTION_DAYS;
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const cutoffYmd = cutoff.toISOString().slice(0, 10);

  const candidates: Array<{
    submission: OpenFdaSubmission;
    dateYmd: string;
    isOrig: boolean;
  }> = [];

  for (const submission of submissions ?? []) {
    if (submission.submission_status?.trim().toUpperCase() !== "AP") continue;
    const dateYmd = parseOpenFdaDate(submission.submission_status_date);
    if (!dateYmd || dateYmd < cutoffYmd) continue;
    candidates.push({
      submission,
      dateYmd,
      isOrig: submission.submission_type?.trim().toUpperCase() === "ORIG",
    });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const byDate = b.dateYmd.localeCompare(a.dateYmd);
    if (byDate !== 0) return byDate;
    if (a.isOrig !== b.isOrig) return a.isOrig ? -1 : 1;
    return 0;
  });

  const best = candidates[0];
  return { submission: best.submission, dateYmd: best.dateYmd };
}

function buildOpenFdaUrl(now: Date = new Date()): string {
  const from = retentionWindowStart(now);
  const to = yyyymmdd(now);
  const search = `submissions.submission_status:AP AND submissions.submission_status_date:[${from} TO ${to}]`;
  const params = new URLSearchParams({
    search,
    sort: "submissions.submission_status_date:desc",
    limit: "25",
  });
  return `https://api.fda.gov/drug/drugsfda.json?${params.toString()}`;
}

/**
 * openFDA recent drug approvals / application events (free, no key required
 * for modest rate limits). Soft network failures bubble to the orchestrator.
 *
 * Queries only the retention window and stamps catalysts with the newest
 * in-window AP submission date so they are not immediately wiped by the
 * 30-day purge that runs after SEC ingest.
 */
export async function fetchOpenFda(): Promise<SourceFetchResult> {
  const url = buildOpenFdaUrl();

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
      submissions?: OpenFdaSubmission[];
      openfda?: { brand_name?: string[]; generic_name?: string[] };
    }>;
  };

  const normalized: NormalizedCatalyst[] = [];
  const userAgent = process.env.SEC_EDGAR_USER_AGENT?.trim() || "";

  for (const row of payload.results ?? []) {
    const app = row.application_number?.trim();
    if (!app) continue;

    const picked = pickRecentApprovedSubmission(row.submissions);
    if (!picked) continue;

    const brand =
      row.openfda?.brand_name?.[0] ||
      row.products?.[0]?.brand_name ||
      "Drug approval";
    const sponsor = row.sponsor_name?.trim() || null;
    const companyName = resolveDisplayCompanyName(sponsor);
    const displayTitle = formatFdaApprovalTitle(companyName);
    const { submission, dateYmd: date } = picked;
    const classLabel =
      submission.submission_class_code_description?.trim() ||
      submission.submission_class_code?.trim() ||
      null;

    // Sponsor -> symbol resolution: without it these rows can never match a
    // trader's watchlist / quiet mode / alerts (see symbol-resolver.ts).
    const resolved = await resolveSymbolFromName(sponsor, { userAgent });

    normalized.push({
      provider: "openfda",
      externalId: `openfda:${app}:${date}`,
      url: `https://api.fda.gov/drug/drugsfda.json?search=application_number:"${app}"`,
      rawContent: row,
      symbol: resolved?.symbol ?? null,
      symbolSource: resolved?.source ?? "unresolved",
      companyName,
      type: "FDA Approval",
      title: displayTitle,
      headline: displayTitle,
      eventCategory: "regulatory",
      subcategory: "openfda_approval",
      timestamp: toIsoTimestamp(date),
      summary: [
        submission.submission_type,
        submission.submission_status,
        classLabel,
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
