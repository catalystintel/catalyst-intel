import { formatClinicalTrialTitle } from "@/lib/catalysts/catalyst-titles";
import { resolveSymbolFromName } from "@/lib/catalysts/symbol-resolver";
import {
  ingestNormalizedCatalysts,
  toSourceResult,
  type NormalizedCatalyst,
  type SourceFetchResult,
} from "@/lib/jobs/ingest-pipeline";

interface CtStudy {
  protocolSection?: {
    identificationModule?: {
      nctId?: string;
      briefTitle?: string;
      organization?: { fullName?: string };
    };
    statusModule?: {
      overallStatus?: string;
      lastUpdatePostDateStruct?: { date?: string };
      startDateStruct?: { date?: string };
    };
    sponsorCollaboratorsModule?: {
      leadSponsor?: { name?: string };
    };
    conditionsModule?: { conditions?: string[] };
  };
}

/**
 * ClinicalTrials.gov recent study updates (free API v2). No key required.
 *
 * Quality-first: only material status changes (completed / terminated /
 * suspended / withdrawn). "Recruiting" updates are high-volume noise for
 * day traders. Rows still need symbol resolution at ingest (quality gate).
 */
export async function fetchClinicalTrials(): Promise<SourceFetchResult> {
  const url = new URL("https://clinicaltrials.gov/api/v2/studies");
  url.searchParams.set("pageSize", "25");
  url.searchParams.set("sort", "LastUpdatePostDate:desc");
  url.searchParams.set(
    "query.term",
    "AREA[OverallStatus]COMPLETED OR AREA[OverallStatus]TERMINATED OR AREA[OverallStatus]SUSPENDED OR AREA[OverallStatus]WITHDRAWN",
  );

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(
      `ClinicalTrials.gov failed (${res.status}): ${res.statusText}`,
    );
  }

  const payload = (await res.json()) as { studies?: CtStudy[] };
  const normalized: NormalizedCatalyst[] = [];

  for (const study of payload.studies ?? []) {
    const idMod = study.protocolSection?.identificationModule;
    const statusMod = study.protocolSection?.statusModule;
    const nctId = idMod?.nctId?.trim();
    if (!nctId) continue;

    const studyTitle = idMod?.briefTitle?.trim() || nctId;
    const sponsor =
      study.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name?.trim() ||
      idMod?.organization?.fullName?.trim() ||
      null;
    const date =
      statusMod?.lastUpdatePostDateStruct?.date?.trim() ||
      statusMod?.startDateStruct?.date?.trim() ||
      new Date().toISOString().slice(0, 10);
    const conditions =
      study.protocolSection?.conditionsModule?.conditions?.slice(0, 3) ?? [];
    const status = statusMod?.overallStatus?.trim() || "Clinical trial update";

    const resolved = await resolveSymbolFromName(sponsor, {
      userAgent: process.env.SEC_EDGAR_USER_AGENT?.trim() || "",
    });

    normalized.push({
      provider: "clinicaltrials",
      externalId: `clinicaltrials:${nctId}:${date}`,
      url: `https://clinicaltrials.gov/study/${nctId}`,
      rawContent: study,
      symbol: resolved?.symbol ?? null,
      symbolSource: resolved?.source ?? "unresolved",
      companyName: sponsor,
      type: "Clinical Trial",
      title: formatClinicalTrialTitle(sponsor),
      headline: status,
      eventCategory: "clinical",
      subcategory: "clinicaltrials_update",
      timestamp: new Date(`${date}T12:00:00.000Z`).toISOString(),
      summary: [studyTitle, conditions.join(", ")].filter(Boolean).join(" · "),
      confidence: 65,
      tags: ["clinical", ...conditions.map((c) => c.toLowerCase()).slice(0, 2)],
    });
  }

  const result = await ingestNormalizedCatalysts(normalized, { purge: false });
  return toSourceResult("clinicaltrials", result);
}
