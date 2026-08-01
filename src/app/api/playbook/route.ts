import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import {
  playbookSettings,
  watchlists,
  type WatchlistCriteria,
} from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import {
  DEFAULT_PLAYBOOK_CATEGORIES,
  normalizePlaybookCategories,
  normalizeWatchlistIds,
  type QuietSignalWatchlist,
} from "@/lib/catalysts/playbook";
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
    key: `playbook:${ip}`,
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

/**
 * Resolves `watchlistIds` against the user's own saved watchlists — drops
 * ids that were deleted or belong to someone else, so a stale reference
 * can never widen quiet mode beyond the user's own rules.
 */
async function resolveSignalWatchlists(
  userId: number,
  watchlistIds: number[],
): Promise<{ ids: number[]; signalWatchlists: QuietSignalWatchlist[] }> {
  if (watchlistIds.length === 0) return { ids: [], signalWatchlists: [] };

  const rows = await db
    .select({ id: watchlists.id, criteria: watchlists.criteria })
    .from(watchlists)
    .where(
      and(eq(watchlists.userId, userId), inArray(watchlists.id, watchlistIds)),
    )
    .all();

  const byId = new Map(rows.map((r) => [r.id, r]));
  // Preserve the caller's order/dedup, but only for ids that still exist.
  const ids = watchlistIds.filter((id) => byId.has(id));
  const signalWatchlists = ids.map((id) => ({
    id,
    criteria: (byId.get(id)?.criteria ?? {}) as WatchlistCriteria,
  }));
  return { ids, signalWatchlists };
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth && auth.error) return auth.error;
  const { user, limitResult } = auth as {
    user: NonNullable<(typeof auth)["user"]>;
    limitResult: NonNullable<(typeof auth)["limitResult"]>;
  };

  const row = await db
    .select()
    .from(playbookSettings)
    .where(eq(playbookSettings.userId, user.id))
    .get();

  if (!row) {
    return withRateLimitHeaders(
      NextResponse.json({
        categories: DEFAULT_PLAYBOOK_CATEGORIES,
        quietMode: false,
        watchlistIds: [],
        signalWatchlists: [],
        persisted: false,
      }),
      limitResult,
    );
  }

  const { ids, signalWatchlists } = await resolveSignalWatchlists(
    user.id,
    normalizeWatchlistIds(row.watchlistIds),
  );

  return withRateLimitHeaders(
    NextResponse.json({
      categories: normalizePlaybookCategories(row.categories),
      quietMode: Boolean(row.quietMode),
      watchlistIds: ids,
      signalWatchlists,
      persisted: true,
    }),
    limitResult,
  );
}

export async function PUT(request: NextRequest) {
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

  const existing = await db
    .select({
      id: playbookSettings.id,
      categories: playbookSettings.categories,
      watchlistIds: playbookSettings.watchlistIds,
    })
    .from(playbookSettings)
    .where(eq(playbookSettings.userId, user.id))
    .get();

  // `categories` is legacy/inert for matching (see table comment) — only
  // overwrite it when the caller explicitly sends a value, so unrelated
  // updates (e.g. toggling quiet mode) don't wipe it out from under the
  // one-click "migrate to a watchlist" action. Same partial-patch treatment
  // for `watchlistIds` so a quiet-mode-only toggle can't drop it either.
  const categories =
    raw.categories !== undefined
      ? normalizePlaybookCategories(raw.categories)
      : normalizePlaybookCategories(existing?.categories);
  const quietMode = Boolean(raw.quietMode);
  const { ids, signalWatchlists } = await resolveSignalWatchlists(
    user.id,
    normalizeWatchlistIds(
      raw.watchlistIds !== undefined
        ? raw.watchlistIds
        : existing?.watchlistIds,
    ),
  );

  if (existing) {
    await db
      .update(playbookSettings)
      .set({
        categories,
        quietMode,
        watchlistIds: ids,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(playbookSettings.userId, user.id))
      .run();
  } else {
    await db
      .insert(playbookSettings)
      .values({
        userId: user.id,
        categories,
        quietMode,
        watchlistIds: ids,
      })
      .run();
  }

  return withRateLimitHeaders(
    NextResponse.json({
      categories,
      quietMode,
      watchlistIds: ids,
      signalWatchlists,
      persisted: true,
    }),
    limitResult,
  );
}
