import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getCurrentAppUser } from "@/lib/auth/current-user";
import { fetchSecEdgar } from "@/lib/jobs/fetch-sec-edgar";
import { getPostHogClient } from "@/lib/posthog-server";

function isValidCronSecret(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const provided = request.headers.get("x-cron-secret");
  if (!provided) return false;

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Triggers the SEC EDGAR ingestion job. Accepts either:
 *  - an authenticated admin session (used by the "/admin" page button), or
 *  - a shared secret header (used by the production GitHub Actions cron -
 *    see DEPLOYMENT.md), since that caller has no browser session/cookie.
 */
export async function POST(request: NextRequest) {
  let triggerDistinctId = "cron";

  if (!isValidCronSecret(request)) {
    const user = await getCurrentAppUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    }

    triggerDistinctId = user.supabaseUserId;
  }

  try {
    const result = await fetchSecEdgar();
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: triggerDistinctId,
      event: "sec_edgar_ingestion_completed",
      properties: {
        fetched: result.fetched,
        inserted: result.inserted,
        skipped: result.skipped,
        errors: result.errors,
        trigger: triggerDistinctId === "cron" ? "cron" : "admin_ui",
      },
    });
    await posthog.flush();
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Fetch job failed.";
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: triggerDistinctId,
      event: "sec_edgar_ingestion_failed",
      properties: {
        error_message: errorMessage,
        trigger: triggerDistinctId === "cron" ? "cron" : "admin_ui",
      },
    });
    await posthog.flush();
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
