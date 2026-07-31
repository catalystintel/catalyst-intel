import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { dismissedCatalysts } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";

async function requireUser(request: NextRequest) {
  if (!isLibsqlConfigured()) {
    return {
      error: NextResponse.json(
        { error: databaseUnavailableMessage() },
        { status: 503 },
      ),
    };
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `dismiss:${ip}`,
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
 * List the current user's dismissed catalyst ids (newest first, capped).
 * Used by the Live tape to restore dismissals across devices.
 */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth && auth.error) return auth.error;
  const { user, limitResult } = auth as {
    user: NonNullable<(typeof auth)["user"]>;
    limitResult: NonNullable<(typeof auth)["limitResult"]>;
  };

  const rows = await db
    .select({
      catalystId: dismissedCatalysts.catalystId,
      dismissedAt: dismissedCatalysts.dismissedAt,
    })
    .from(dismissedCatalysts)
    .where(eq(dismissedCatalysts.userId, user.id))
    .orderBy(asc(dismissedCatalysts.dismissedAt))
    .all();

  // Keep the same ~200 window localStorage used, newest ids win.
  const ids = rows.map((r) => r.catalystId).slice(-200);

  return withRateLimitHeaders(NextResponse.json({ ids }), limitResult);
}

/**
 * Dismiss one or more catalysts. Body: `{ catalystId: number }` or
 * `{ catalystIds: number[] }` (for one-shot localStorage migration).
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
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

  const raw = body as Record<string, unknown>;
  const ids: number[] = [];
  if (typeof raw.catalystId === "number" && Number.isFinite(raw.catalystId)) {
    ids.push(Math.floor(raw.catalystId));
  }
  if (Array.isArray(raw.catalystIds)) {
    for (const n of raw.catalystIds) {
      if (typeof n === "number" && Number.isFinite(n) && n > 0) {
        ids.push(Math.floor(n));
      }
    }
  }

  const unique = [...new Set(ids.filter((id) => id > 0))].slice(0, 200);
  if (unique.length === 0) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "catalystId required." }, { status: 400 }),
      limitResult,
    );
  }

  const existing = await db
    .select({ catalystId: dismissedCatalysts.catalystId })
    .from(dismissedCatalysts)
    .where(
      and(
        eq(dismissedCatalysts.userId, user.id),
        inArray(dismissedCatalysts.catalystId, unique),
      ),
    )
    .all();
  const already = new Set(existing.map((r) => r.catalystId));
  const toInsert = unique.filter((id) => !already.has(id));

  if (toInsert.length > 0) {
    await db
      .insert(dismissedCatalysts)
      .values(
        toInsert.map((catalystId) => ({
          userId: user.id,
          catalystId,
        })),
      )
      .run();
  }

  return withRateLimitHeaders(
    NextResponse.json({ ok: true, dismissed: unique.length }),
    limitResult,
  );
}

/** Undo a dismissal. Query: `?catalystId=123`. */
export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth && auth.error) return auth.error;
  const { user, limitResult } = auth as {
    user: NonNullable<(typeof auth)["user"]>;
    limitResult: NonNullable<(typeof auth)["limitResult"]>;
  };

  const idParam = Number(request.nextUrl.searchParams.get("catalystId") ?? "");
  if (!Number.isFinite(idParam) || idParam <= 0) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "catalystId required." }, { status: 400 }),
      limitResult,
    );
  }

  await db
    .delete(dismissedCatalysts)
    .where(
      and(
        eq(dismissedCatalysts.userId, user.id),
        eq(dismissedCatalysts.catalystId, idParam),
      ),
    )
    .run();

  return withRateLimitHeaders(NextResponse.json({ ok: true }), limitResult);
}
