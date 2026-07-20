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

export type AdminFetchAuth =
  | { ok: true; isCron: true; distinctId: "cron" }
  | {
      ok: true;
      isCron: false;
      distinctId: string;
      limitResult: ReturnType<typeof checkRateLimit>;
    }
  | { ok: false; response: NextResponse };

/**
 * Shared gate for admin ingest triggers: cron secret OR allowlisted admin.
 * Valid cron callers bypass per-IP rate limits.
 */
export async function authorizeAdminFetch(
  request: NextRequest,
  rateLimitKey: string,
): Promise<AdminFetchAuth> {
  if (!isLibsqlConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: LIBSQL_SETUP_HINT },
        { status: 503 },
      ),
    };
  }

  const providedSecret = request.headers.get("x-cron-secret");
  const isCron = isValidCronSecret(process.env.CRON_SECRET, providedSecret);
  if (isCron) {
    return { ok: true, isCron: true, distinctId: "cron" };
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: rateLimitKey,
    ...RATE_LIMITS.adminWrite,
  });

  if (!limitResult.ok) {
    return { ok: false, response: rateLimitExceededResponse(limitResult) };
  }

  const user = await getCurrentAppUser();
  if (!user) {
    return {
      ok: false,
      response: withRateLimitHeaders(
        NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
        limitResult,
      ),
    };
  }

  if (!user.isAdmin) {
    return {
      ok: false,
      response: withRateLimitHeaders(
        NextResponse.json({ error: "Admin access required." }, { status: 403 }),
        limitResult,
      ),
    };
  }

  return {
    ok: true,
    isCron: false,
    distinctId: user.supabaseUserId,
    limitResult,
  };
}

export function jsonWithAuth(
  auth: Extract<AdminFetchAuth, { ok: true }>,
  body: unknown,
  init?: ResponseInit,
): NextResponse {
  const response = NextResponse.json(body, init);
  if (!auth.isCron) {
    return withRateLimitHeaders(response, auth.limitResult);
  }
  return response;
}
