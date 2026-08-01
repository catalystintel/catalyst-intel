import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { watchlists } from "@/db/schema";
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
import { normalizeWatchlistCriteria } from "@/lib/watchlist/normalize-criteria";

async function requireUser(request: NextRequest) {
  if (!isLibsqlConfigured()) {
    return {
      error: NextResponse.json(
        { error: databaseUnavailableMessage() },
        { status: 503 },
      ),
    };
  }
  if (!isSameOriginRequest(request)) {
    return { error: sameOriginForbiddenResponse() };
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `watchlists:${ip}`,
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

  return { user, limitResult };
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if ("error" in auth && auth.error) return auth.error;
  const { user, limitResult } = auth as {
    user: NonNullable<(typeof auth)["user"]>;
    limitResult: NonNullable<(typeof auth)["limitResult"]>;
  };

  const id = parseId((await params).id);
  if (!id) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Invalid id." }, { status: 400 }),
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

  const patch: { name?: string; criteria?: object; updatedAt: string } = {
    updatedAt: new Date().toISOString(),
  };
  if (typeof raw.name === "string" && raw.name.trim()) {
    patch.name = raw.name.trim().slice(0, 80);
  }
  if (raw.criteria !== undefined) {
    const criteria = normalizeWatchlistCriteria(raw.criteria);
    if (Object.keys(criteria).length === 0) {
      return withRateLimitHeaders(
        NextResponse.json(
          { error: "criteria must have at least one filter." },
          { status: 400 },
        ),
        limitResult,
      );
    }
    patch.criteria = criteria;
  }

  const row = await db
    .update(watchlists)
    .set(patch)
    .where(and(eq(watchlists.id, id), eq(watchlists.userId, user.id)))
    .returning()
    .get();

  if (!row) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Watchlist not found." }, { status: 404 }),
      limitResult,
    );
  }

  return withRateLimitHeaders(
    NextResponse.json({
      id: row.id,
      name: row.name,
      criteria: row.criteria,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }),
    limitResult,
  );
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if ("error" in auth && auth.error) return auth.error;
  const { user, limitResult } = auth as {
    user: NonNullable<(typeof auth)["user"]>;
    limitResult: NonNullable<(typeof auth)["limitResult"]>;
  };

  const id = parseId((await params).id);
  if (!id) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Invalid id." }, { status: 400 }),
      limitResult,
    );
  }

  await db
    .delete(watchlists)
    .where(and(eq(watchlists.id, id), eq(watchlists.userId, user.id)))
    .run();

  return withRateLimitHeaders(NextResponse.json({ ok: true, id }), limitResult);
}
