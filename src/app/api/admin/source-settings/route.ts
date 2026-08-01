import { NextResponse, type NextRequest } from "next/server";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import {
  feedSourceCatalogEntries,
  loadSourceSettingsForUser,
  normalizeEnabledSources,
  normalizeShowSourceLabels,
  upsertEnabledSourcesForUser,
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

function catalogPayload() {
  return feedSourceCatalogEntries().map((s) => ({
    id: s.id,
    label: s.label,
    contributes: s.contributes,
    fetchEnabled: s.fetchEnabled !== false,
  }));
}

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
      enabledSources: settings.enabledSources,
      showSourceLabels: settings.showSourceLabels,
      persisted: settings.persisted,
      catalog: catalogPayload(),
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

  const hasEnabled = "enabledSources" in raw;
  const hasShowLabels = "showSourceLabels" in raw;
  if (!hasEnabled && !hasShowLabels) {
    return withRateLimitHeaders(
      NextResponse.json(
        {
          error:
            "Provide enabledSources and/or showSourceLabels in the request body.",
        },
        { status: 400 },
      ),
      limitResult,
    );
  }

  if (hasEnabled) {
    await upsertEnabledSourcesForUser(
      user.id,
      normalizeEnabledSources(raw.enabledSources),
    );
  }
  if (hasShowLabels) {
    await upsertShowSourceLabelsForUser(
      user.id,
      normalizeShowSourceLabels(raw.showSourceLabels),
    );
  }

  const settings = await loadSourceSettingsForUser(user.id);

  return withRateLimitHeaders(
    NextResponse.json({
      enabledSources: settings.enabledSources,
      showSourceLabels: settings.showSourceLabels,
      persisted: true,
      catalog: catalogPayload(),
    }),
    limitResult,
  );
}
