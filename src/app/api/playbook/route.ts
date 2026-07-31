import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { playbookSettings } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import {
  DEFAULT_PLAYBOOK_CATEGORIES,
  normalizePlaybookCategories,
} from "@/lib/catalysts/playbook";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";

async function requireUser(request: NextRequest) {
  if (!isLibsqlConfigured()) {
    return {
      error: NextResponse.json({ error: databaseUnavailableMessage() }, { status: 503 }),
    };
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
        persisted: false,
      }),
      limitResult,
    );
  }

  return withRateLimitHeaders(
    NextResponse.json({
      categories: normalizePlaybookCategories(row.categories),
      quietMode: Boolean(row.quietMode),
      persisted: true,
    }),
    limitResult,
  );
}

export async function PUT(request: NextRequest) {
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

  const raw =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const categories = normalizePlaybookCategories(raw.categories);
  const quietMode = Boolean(raw.quietMode);

  const existing = await db
    .select({ id: playbookSettings.id })
    .from(playbookSettings)
    .where(eq(playbookSettings.userId, user.id))
    .get();

  if (existing) {
    await db
      .update(playbookSettings)
      .set({
        categories,
        quietMode,
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
      })
      .run();
  }

  return withRateLimitHeaders(
    NextResponse.json({ categories, quietMode, persisted: true }),
    limitResult,
  );
}
