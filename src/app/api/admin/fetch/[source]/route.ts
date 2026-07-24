import { NextResponse, type NextRequest } from "next/server";

import { authorizeAdminFetch, jsonWithAuth } from "@/lib/auth/admin-fetch";
import {
  CATALYST_SOURCE_IDS,
  fetchCatalystSource,
  isCatalystSourceId,
} from "@/lib/jobs/fetch-all-sources";

type RouteContext = { params: Promise<{ source: string }> };

/**
 * Per-source ingest trigger. Admin session or x-cron-secret.
 * GET lists available source ids (admin/cron only — avoid unauthenticated recon).
 */
export async function GET(request: NextRequest) {
  const auth = await authorizeAdminFetch(request, "admin-fetch-sources-list");
  if (!auth.ok) return auth.response;
  return jsonWithAuth(auth, { sources: CATALYST_SOURCE_IDS });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { source: rawSource } = await context.params;
  const source = decodeURIComponent(rawSource).trim().toLowerCase();

  if (!isCatalystSourceId(source)) {
    return NextResponse.json(
      {
        error: `Unknown source "${rawSource}".`,
        sources: CATALYST_SOURCE_IDS,
      },
      { status: 400 },
    );
  }

  const auth = await authorizeAdminFetch(
    request,
    `admin-fetch-source:${source}`,
  );
  if (!auth.ok) return auth.response;

  const result = await fetchCatalystSource(source);
  const status =
    result.status === "error" ? 500 : result.status === "skipped" ? 200 : 200;

  return jsonWithAuth(auth, result, { status });
}
