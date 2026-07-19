import { NextResponse, type NextRequest } from "next/server";

import { LIBSQL_SETUP_HINT, isLibsqlConfigured } from "@/db/env";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { isValidCronSecret } from "@/lib/auth/cron-secret";
import { fetchSecEdgar } from "@/lib/jobs/fetch-sec-edgar";

/**
 * Triggers the SEC EDGAR ingestion job. Accepts either:
 *  - an authenticated admin session (used by the "/admin" page button), or
 *  - a shared secret header (used by the production GitHub Actions cron -
 *    see DEPLOYMENT.md), since that caller has no browser session/cookie.
 */
export async function POST(request: NextRequest) {
  if (!isLibsqlConfigured()) {
    return NextResponse.json({ error: LIBSQL_SETUP_HINT }, { status: 503 });
  }

  const providedSecret = request.headers.get("x-cron-secret");

  if (!isValidCronSecret(process.env.CRON_SECRET, providedSecret)) {
    const user = await getCurrentAppUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    }
  }

  try {
    const result = await fetchSecEdgar();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fetch job failed." },
      { status: 500 },
    );
  }
}
