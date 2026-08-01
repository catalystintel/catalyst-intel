import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { watchlists, type WatchlistCriteria } from "@/db/schema";
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

async function requireUser(
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

function serializeWatchlist(row: typeof watchlists.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    criteria: (row.criteria ?? {}) as WatchlistCriteria,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth && auth.error) return auth.error;
  const { user, limitResult } = auth as {
    user: NonNullable<(typeof auth)["user"]>;
    limitResult: NonNullable<(typeof auth)["limitResult"]>;
  };

  const rows = await db
    .select()
    .from(watchlists)
    .where(eq(watchlists.userId, user.id))
    .orderBy(desc(watchlists.createdAt))
    .all();

  return withRateLimitHeaders(
    NextResponse.json({ watchlists: rows.map(serializeWatchlist) }),
    limitResult,
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request, { mutate: true });
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

  const name =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim().slice(0, 80)
      : "";
  if (!name) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "name is required." }, { status: 400 }),
      limitResult,
    );
  }

  const criteria = normalizeWatchlistCriteria(raw.criteria);
  if (Object.keys(criteria).length === 0) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "Add at least one filter before saving." },
        { status: 400 },
      ),
      limitResult,
    );
  }

  const existingCount = (
    await db
      .select({ id: watchlists.id })
      .from(watchlists)
      .where(eq(watchlists.userId, user.id))
      .all()
  ).length;
  if (existingCount >= 50) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "Watchlist limit reached (50). Delete one to add more." },
        { status: 400 },
      ),
      limitResult,
    );
  }

  const row = await db
    .insert(watchlists)
    .values({ userId: user.id, name, criteria })
    .returning()
    .get();

  return withRateLimitHeaders(
    NextResponse.json(serializeWatchlist(row), { status: 201 }),
    limitResult,
  );
}
