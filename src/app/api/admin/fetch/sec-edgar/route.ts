import { NextResponse, type NextRequest } from "next/server";

import { LIBSQL_SETUP_HINT, isLibsqlConfigured } from "@/db/env";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { isValidCronSecret } from "@/lib/auth/cron-secret";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";
import { fetchSecEdgar } from "@/lib/jobs/fetch-sec-edgar";
import { formatSecFetchError } from "@/lib/jobs/sec-edgar-http";
import {
  getPostHogClient,
  isPostHogServerConfigured,
} from "@/lib/posthog-server";

/**
 * Triggers the SEC EDGAR ingestion job. Accepts either:
 *  - an authenticated allowlisted admin session (used by the "/admin" page), or
 *  - a shared secret header (used by the production GitHub Actions cron -
 *    see DEPLOYMENT.md), since that caller has no browser session/cookie.
 *
 * Valid cron secret callers bypass per-IP rate limits. Session-based admin
 * triggers are rate-limited more strictly than feed reads.
 */
export async function POST(request: NextRequest) {
  if (!isLibsqlConfigured()) {
    return NextResponse.json({ error: LIBSQL_SETUP_HINT }, { status: 503 });
  }

  const providedSecret = request.headers.get("x-cron-secret");
  const isCron = isValidCronSecret(process.env.CRON_SECRET, providedSecret);
  let triggerDistinctId = "cron";

  if (!isCron) {
    const ip = getClientIp(request);
    const limitResult = checkRateLimit({
      key: `admin-fetch:${ip}`,
      ...RATE_LIMITS.adminWrite,
    });

    if (!limitResult.ok) {
      return rateLimitExceededResponse(limitResult);
    }

    const user = await getCurrentAppUser();

    if (!user) {
      return withRateLimitHeaders(
        NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
        limitResult,
      );
    }

    if (!user.isAdmin) {
      return withRateLimitHeaders(
        NextResponse.json({ error: "Admin access required." }, { status: 403 }),
        limitResult,
      );
    }

    triggerDistinctId = user.supabaseUserId;

    try {
      const result = await fetchSecEdgar({ mode: "primary" });
      await captureIngestionEvent(triggerDistinctId, "completed", {
        ...result,
      });
      return withRateLimitHeaders(NextResponse.json(result), limitResult);
    } catch (error) {
      const errorMessage = formatSecFetchError(error);
      await captureIngestionEvent(triggerDistinctId, "failed", {
        error_message: errorMessage,
      });
      return withRateLimitHeaders(
        NextResponse.json({ error: errorMessage }, { status: 500 }),
        limitResult,
      );
    }
  }

  try {
    const result = await fetchSecEdgar({ mode: "primary" });
    await captureIngestionEvent(triggerDistinctId, "completed", { ...result });
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = formatSecFetchError(error);
    await captureIngestionEvent(triggerDistinctId, "failed", {
      error_message: errorMessage,
    });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

async function captureIngestionEvent(
  distinctId: string,
  outcome: "completed" | "failed",
  properties: Record<string, unknown>,
) {
  if (!isPostHogServerConfigured()) return;
  const posthog = getPostHogClient();
  posthog.capture({
    distinctId,
    event:
      outcome === "completed"
        ? "sec_edgar_ingestion_completed"
        : "sec_edgar_ingestion_failed",
    properties: {
      ...properties,
      trigger: distinctId === "cron" ? "cron" : "admin_ui",
    },
  });
  await posthog.flush();
}
