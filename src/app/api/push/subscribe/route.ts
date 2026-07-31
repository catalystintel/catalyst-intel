import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";

import { databaseUnavailableMessage, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";

/**
 * Saves/removes a browser Web Push subscription (see lib/push/web-push).
 * One user can have many rows — one per browser/device that granted
 * notification permission.
 */
export async function POST(request: NextRequest) {
  if (!isLibsqlConfigured()) {
    return NextResponse.json(
      { error: databaseUnavailableMessage() },
      { status: 503 },
    );
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `push-subscribe:${ip}`,
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
    return withRateLimitHeaders(
      NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
      limitResult,
    );
  }

  const raw =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const endpoint = typeof raw.endpoint === "string" ? raw.endpoint.trim() : "";
  const keys =
    typeof raw.keys === "object" && raw.keys !== null
      ? (raw.keys as Record<string, unknown>)
      : {};
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh : "";
  const auth = typeof keys.auth === "string" ? keys.auth : "";

  if (!endpoint || !p256dh || !auth) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "endpoint, keys.p256dh, keys.auth are required." },
        { status: 400 },
      ),
      limitResult,
    );
  }

  const existing = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .get();

  if (existing) {
    await db
      .update(pushSubscriptions)
      .set({ userId: user.id, p256dh, auth })
      .where(eq(pushSubscriptions.id, existing.id))
      .run();
  } else {
    await db
      .insert(pushSubscriptions)
      .values({ userId: user.id, endpoint, p256dh, auth })
      .run();
  }

  return withRateLimitHeaders(NextResponse.json({ ok: true }), limitResult);
}

export async function DELETE(request: NextRequest) {
  if (!isLibsqlConfigured()) {
    return NextResponse.json(
      { error: databaseUnavailableMessage() },
      { status: 503 },
    );
  }

  const user = await getCurrentAppUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const endpoint = request.nextUrl.searchParams.get("endpoint")?.trim();
  if (!endpoint) {
    return NextResponse.json(
      { error: "endpoint is required." },
      { status: 400 },
    );
  }

  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.endpoint, endpoint),
        eq(pushSubscriptions.userId, user.id),
      ),
    )
    .run();

  return NextResponse.json({ ok: true });
}
