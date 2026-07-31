import { NextResponse, type NextRequest } from "next/server";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";
import {
  isSameOriginRequest,
  sameOriginForbiddenResponse,
} from "@/lib/http/same-origin";
import { analyzeCatalystOnDemand } from "@/lib/jobs/llm-triage";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * On-demand AI triage for a single catalyst.
 * Cached forever on the row after the first successful run — never re-analyzes.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  if (!isLibsqlConfigured()) {
    return NextResponse.json(
      { error: databaseUnavailableMessage() },
      { status: 503 },
    );
  }

  if (!isSameOriginRequest(request)) {
    return sameOriginForbiddenResponse();
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `catalysts-analyze:${ip}`,
    ...RATE_LIMITS.catalystsAnalyze,
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

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Invalid catalyst id." }, { status: 400 }),
      limitResult,
    );
  }

  const result = await analyzeCatalystOnDemand(id);
  if (!result.ok) {
    return withRateLimitHeaders(
      NextResponse.json({ error: result.error }, { status: result.status }),
      limitResult,
    );
  }

  return withRateLimitHeaders(
    NextResponse.json({
      ok: true,
      cached: result.cached,
      analysis: result.analysis,
    }),
    limitResult,
  );
}
