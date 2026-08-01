import { NextResponse, type NextRequest } from "next/server";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import {
  loadSourceSettingsForUser,
  normalizeShowSourceLabels,
  upsertShowSourceLabelsForUser,
} from "@/lib/catalysts/user-source-settings";
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

async function requireAdmin(
  request: NextRequest,
  options?: { mutate?: boolean },
) {
  if (!isLibsqlConfigured()) {
    return {
      error: NextResponse.json(
        { error: databaseUnavailableMessage() },
        { status: 503 },
      ),
    };
  }

  if (options?.mutate && !isSameOriginRequest(request)) {
    return { error: sameOriginForbiddenResponse() };
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `admin-source-settings:${ip}`,
    ...RATE_LIMITS.userWrite,
  });
  if (!limitResult.ok) {
    return { error: rateLimitExceededResponse(limitResult) };
  }

  const user = await getCurrentAppUser();
  if (!user) {
    return {
      error: withRateLimitHeaders(
        NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
        limitResult,
      ),
    };
  }

  if (!user.isAdmin) {
    return {
      error: withRateLimitHeaders(
        NextResponse.json({ error: "Admin only." }, { status: 403 }),
        limitResult,
      ),
    };
  }

  return { user, limitResult };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth && auth.error) return auth.error;
  const { user, limitResult } = auth as {
    user: NonNullable<(typeof auth)["user"]>;
    limitResult: NonNullable<(typeof auth)["limitResult"]>;
  };

  const settings = await loadSourceSettingsForUser(user.id);

  return withRateLimitHeaders(
    NextResponse.json({
      showSourceLabels: settings.showSourceLabels,
      persisted: settings.persisted,
    }),
    limitResult,
  );
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request, { mutate: true });
  if ("error" in auth && auth.error) return auth.error;
  const { user, limitResult } = auth as {
    user: NonNullable<(typeof auth)["user"]>;
    limitResult: NonNullable<(typeof auth)["limitResult"]>;
  };

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

  if (!("showSourceLabels" in raw)) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "Provide showSourceLabels in the request body." },
        { status: 400 },
      ),
      limitResult,
    );
  }

  const showSourceLabels = await upsertShowSourceLabelsForUser(
    user.id,
    normalizeShowSourceLabels(raw.showSourceLabels),
  );

  return withRateLimitHeaders(
    NextResponse.json({
      showSourceLabels,
      persisted: true,
    }),
    limitResult,
  );
}
