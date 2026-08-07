import { NextResponse, type NextRequest } from "next/server";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import type { WatchlistCriteria } from "@/db/schema";
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
import { draftWatchlistWithAI } from "@/lib/watchlist/ai-draft";
import { normalizeWatchlistCriteria } from "@/lib/watchlist/normalize-criteria";

/**
 * Drafts (or refines, given `existingCriteria`) a watchlist rule from a
 * plain-English prompt. See `lib/watchlist/ai-draft.ts` for the schema-aware
 * prompt and soft-fail behavior when OpenRouter isn't configured.
 */
export async function POST(request: NextRequest) {
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
    key: `watchlists-ai-draft:${ip}`,
    ...RATE_LIMITS.watchlistsAiDraft,
  });
  if (!limitResult.ok) return rateLimitExceededResponse(limitResult);

  const user = await getCurrentAppUser();
  if (!user) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
      limitResult,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
      limitResult,
    );
  }
  const raw =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  const prompt = typeof raw.prompt === "string" ? raw.prompt.slice(0, 500) : "";
  const existingName =
    typeof raw.existingName === "string"
      ? raw.existingName.slice(0, 80)
      : undefined;
  const existingCriteria: WatchlistCriteria | undefined =
    raw.existingCriteria !== undefined
      ? normalizeWatchlistCriteria(raw.existingCriteria)
      : undefined;

  const result = await draftWatchlistWithAI(prompt, {
    name: existingName,
    criteria: existingCriteria,
  });

  if (!result.ok) {
    return withRateLimitHeaders(
      NextResponse.json({ error: result.error }, { status: 503 }),
      limitResult,
    );
  }

  return withRateLimitHeaders(NextResponse.json(result.draft), limitResult);
}
