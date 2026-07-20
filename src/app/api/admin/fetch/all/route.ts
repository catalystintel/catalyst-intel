import { type NextRequest } from "next/server";

import { authorizeAdminFetch, jsonWithAuth } from "@/lib/auth/admin-fetch";
import { fetchAllCatalystSources } from "@/lib/jobs/fetch-all-sources";
import {
  getPostHogClient,
  isPostHogServerConfigured,
} from "@/lib/posthog-server";

/**
 * Multi-source ingest orchestrator. Runs all catalyst sources via
 * Promise.allSettled. Accepts admin session or x-cron-secret.
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeAdminFetch(request, "admin-fetch-all");
  if (!auth.ok) return auth.response;

  const result = await fetchAllCatalystSources({ includeLaterStubs: false });

  if (isPostHogServerConfigured()) {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: auth.distinctId,
      event: "multi_source_ingestion_completed",
      properties: {
        ...result.totals,
        source_count: result.sources.length,
        trigger: auth.isCron ? "cron" : "admin_ui",
      },
    });
    await posthog.flush();
  }

  return jsonWithAuth(auth, result);
}
