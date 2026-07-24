import { NextResponse, type NextRequest } from "next/server";

import { LIBSQL_SETUP_HINT, isLibsqlConfigured } from "@/db/env";
import { authorizeAdminFetch, jsonWithAuth } from "@/lib/auth/admin-fetch";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { isValidCronSecret } from "@/lib/auth/cron-secret";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";
import { fetchFinnhubNyse } from "@/lib/jobs/fetch-finnhub-nyse";
import { isFinnhubConfigured } from "@/lib/jobs/finnhub-env";

/**
 * Triggers Finnhub NYSE listing ingest (+ light quote enrichment).
 * Admin session or x-cron-secret. Soft-returns when FINNHUB_API_KEY is unset.
 */
export async function POST(request: NextRequest) {
  if (!isLibsqlConfigured()) {
    return NextResponse.json({ error: LIBSQL_SETUP_HINT }, { status: 503 });
  }

  const providedSecret = request.headers.get("x-cron-secret");
  const isCron = isValidCronSecret(process.env.CRON_SECRET, providedSecret);

  if (!isCron) {
    const ip = getClientIp(request);
    const limitResult = checkRateLimit({
      key: `admin-fetch-nyse:${ip}`,
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

    try {
      const result = await fetchFinnhubNyse({ quoteLimit: 12 });
      return withRateLimitHeaders(NextResponse.json(result), limitResult);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Finnhub NYSE fetch failed.";
      return withRateLimitHeaders(
        NextResponse.json({ error: message }, { status: 500 }),
        limitResult,
      );
    }
  }

  try {
    const result = await fetchFinnhubNyse({ quoteLimit: 12 });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Finnhub NYSE fetch failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Lightweight status for admin UI empty states (admin/cron only). */
export async function GET(request: NextRequest) {
  const auth = await authorizeAdminFetch(request, "admin-fetch-nyse-status");
  if (!auth.ok) return auth.response;
  return jsonWithAuth(auth, {
    configured: isFinnhubConfigured(),
  });
}
