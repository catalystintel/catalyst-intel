import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

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
import {
  WATCHLIST_STARTER_PACK_IDS,
  watchlistTemplateById,
} from "@/lib/watchlist/templates";

const MAX_WATCHLISTS = 50;

/**
 * One-tap create from curated templates (or the full starter pack).
 * Skips templates whose name the user already has.
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
    key: `watchlists-templates:${ip}`,
    ...RATE_LIMITS.userWrite,
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
    body = {};
  }
  const raw =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  let templateIds: string[] = [];
  if (raw.starterPack === true) {
    templateIds = [...WATCHLIST_STARTER_PACK_IDS];
  } else if (typeof raw.templateId === "string" && raw.templateId.trim()) {
    templateIds = [raw.templateId.trim()];
  } else if (Array.isArray(raw.templateIds)) {
    templateIds = raw.templateIds.filter(
      (id): id is string => typeof id === "string" && id.trim() !== "",
    );
  }

  if (templateIds.length === 0) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "Provide templateId, templateIds, or starterPack: true." },
        { status: 400 },
      ),
      limitResult,
    );
  }

  const existing = await db
    .select({ id: watchlists.id, name: watchlists.name })
    .from(watchlists)
    .where(eq(watchlists.userId, user.id))
    .all();
  const existingNames = new Set(
    existing.map((r) => r.name.trim().toLowerCase()),
  );
  let remaining = MAX_WATCHLISTS - existing.length;

  const created: {
    id: number;
    name: string;
    criteria: WatchlistCriteria;
    createdAt: string;
    updatedAt: string;
  }[] = [];
  const skipped: string[] = [];

  for (const id of templateIds) {
    const template = watchlistTemplateById(id);
    if (!template) {
      skipped.push(id);
      continue;
    }
    if (existingNames.has(template.name.trim().toLowerCase())) {
      skipped.push(template.id);
      continue;
    }
    if (remaining <= 0) {
      return withRateLimitHeaders(
        NextResponse.json(
          {
            error: "Watchlist limit reached (50). Delete one to add more.",
            created,
            skipped,
          },
          { status: 400 },
        ),
        limitResult,
      );
    }

    const criteria = normalizeWatchlistCriteria(template.criteria);
    const row = await db
      .insert(watchlists)
      .values({
        userId: user.id,
        name: template.name.slice(0, 80),
        criteria,
      })
      .returning()
      .get();

    created.push({
      id: row.id,
      name: row.name,
      criteria: (row.criteria ?? {}) as WatchlistCriteria,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
    existingNames.add(template.name.trim().toLowerCase());
    remaining -= 1;
  }

  return withRateLimitHeaders(
    NextResponse.json({
      ok: true,
      created,
      skipped,
    }),
    limitResult,
  );
}
