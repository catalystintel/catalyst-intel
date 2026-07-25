import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { databaseSetupHint, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { watchlistEntries } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { normalizeSymbol } from "@/lib/alerts/normalize";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";

async function requireUser(request: NextRequest) {
  if (!isLibsqlConfigured()) {
    return {
      error: NextResponse.json({ error: databaseSetupHint() }, { status: 503 }),
    };
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `watchlist:${ip}`,
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

  const rows = await db
    .select({
      id: watchlistEntries.id,
      symbol: watchlistEntries.symbol,
      createdAt: watchlistEntries.createdAt,
    })
    .from(watchlistEntries)
    .where(eq(watchlistEntries.userId, user.id))
    .orderBy(asc(watchlistEntries.symbol))
    .all();

  return withRateLimitHeaders(
    NextResponse.json({ symbols: rows }),
    limitResult,
  );
}

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

  const symbolRaw =
    typeof body === "object" && body !== null && "symbol" in body
      ? String((body as { symbol: unknown }).symbol)
      : "";
  const symbol = normalizeSymbol(symbolRaw);
  if (!symbol) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Invalid symbol." }, { status: 400 }),
      limitResult,
    );
  }

  const existing = await db
    .select({ id: watchlistEntries.id })
    .from(watchlistEntries)
    .where(
      and(
        eq(watchlistEntries.userId, user.id),
        eq(watchlistEntries.symbol, symbol),
      ),
    )
    .get();

  if (existing) {
    return withRateLimitHeaders(
      NextResponse.json({ id: existing.id, symbol }),
      limitResult,
    );
  }

  const row = await db
    .insert(watchlistEntries)
    .values({ userId: user.id, symbol })
    .returning({ id: watchlistEntries.id, symbol: watchlistEntries.symbol })
    .get();

  return withRateLimitHeaders(
    NextResponse.json(row, { status: 201 }),
    limitResult,
  );
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth && auth.error) return auth.error;
  const { user, limitResult } = auth as {
    user: NonNullable<(typeof auth)["user"]>;
    limitResult: NonNullable<(typeof auth)["limitResult"]>;
  };

  const symbolParam = request.nextUrl.searchParams.get("symbol") ?? "";
  const symbol = normalizeSymbol(symbolParam);
  if (!symbol) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Invalid symbol." }, { status: 400 }),
      limitResult,
    );
  }

  await db
    .delete(watchlistEntries)
    .where(
      and(
        eq(watchlistEntries.userId, user.id),
        eq(watchlistEntries.symbol, symbol),
      ),
    )
    .run();

  return withRateLimitHeaders(
    NextResponse.json({ ok: true, symbol }),
    limitResult,
  );
}
