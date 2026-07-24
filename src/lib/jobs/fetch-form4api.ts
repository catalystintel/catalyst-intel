import {
  skippedSourceResult,
  type SourceFetchResult,
} from "@/lib/jobs/ingest-pipeline";
import { getForm4ApiKey } from "@/lib/jobs/vendor-env";

/**
 * Optional Form4API enrichment.
 *
 * Quality-first: Form 4 already comes from SEC EDGAR Atom (`type=4`).
 * Dual-ingesting Form4API doubles insider volume with near-duplicate rows,
 * so this source is intentionally skipped even when FORM4_API_KEY is set.
 *
 * Auth would be `X-Api-Key` (https://www.form4api.com) if we re-enable later.
 */
export async function fetchForm4Api(): Promise<SourceFetchResult> {
  const hasKey = Boolean(getForm4ApiKey());
  return skippedSourceResult(
    "form4api",
    hasKey
      ? "Form4API intentionally skipped (quality-first): SEC EDGAR already covers Form 4; dual ingest is spam."
      : "FORM4_API_KEY is not set. Form 4 still ingests via SEC EDGAR; Form4API stays skipped to avoid duplicate volume.",
  );
}
