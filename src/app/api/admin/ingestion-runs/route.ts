import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, gte, like, lte, or, sql, type SQL } from "drizzle-orm";

import { databaseSetupHint, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { ingestionRuns } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { withDbRetry } from "@/lib/db/with-db-retry";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";
import type {
  IngestionRunStatus,
  IngestionRunTrigger,
} from "@/lib/jobs/record-ingestion-run";

export const PAGE_SIZE = 20;

/**
 * Paginated audit log of multi-source ingest runs.
 *
 * Query params:
 * - `limit` — page size (default/max 20)
 * - `cursor` — return rows with id < cursor (infinite scroll)
 * - `q` — search trigger / status / sources_json text
 * - `from` / `to` — ISO timestamps bounding `ran_at`
 * - `trigger` — optional cron | admin filter
 * - `status` — optional ok | partial | failed filter
 */
export async function GET(request: NextRequest) {
  if (!isLibsqlConfigured()) {
    return NextResponse.json({ error: databaseSetupHint() }, { status: 503 });
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `ingestion-runs:${ip}`,
    ...RATE_LIMITS.analyticsRead,
  });

  if (!limitResult.ok) {
    return rateLimitExceededResponse(limitResult);
  }

  const user = await getCurrentAppUser();
  if (!user) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
      limitResult,
    );
  }
  if (!user.isAdmin) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Admin access required." }, { status: 403 }),
      limitResult,
    );
  }

  const params = request.nextUrl.searchParams;
  const limitRaw = Number(params.get("limit") ?? String(PAGE_SIZE));
  const limit = Number.isFinite(limitRaw)
    ? Math.min(PAGE_SIZE, Math.max(1, Math.floor(limitRaw)))
    : PAGE_SIZE;

  const cursorRaw = params.get("cursor");
  const cursor =
    cursorRaw && /^\d+$/.test(cursorRaw) ? Number(cursorRaw) : null;

  const q = params.get("q")?.trim() ?? "";
  const from = params.get("from")?.trim() || null;
  const to = params.get("to")?.trim() || null;
  const trigger = parseTrigger(params.get("trigger"));
  const status = parseStatus(params.get("status"));

  const filters: SQL[] = [];
  if (cursor !== null) {
    filters.push(sql`${ingestionRuns.id} < ${cursor}`);
  }
  if (from) {
    filters.push(gte(ingestionRuns.ranAt, from));
  }
  if (to) {
    filters.push(lte(ingestionRuns.ranAt, to));
  }
  if (trigger) {
    filters.push(eq(ingestionRuns.trigger, trigger));
  }
  if (status) {
    filters.push(eq(ingestionRuns.status, status));
  }
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    filters.push(
      or(
        like(ingestionRuns.trigger, pattern),
        like(ingestionRuns.status, pattern),
        like(ingestionRuns.sourcesJson, pattern),
      )!,
    );
  }

  const where = filters.length > 0 ? and(...filters) : undefined;

  const rows = await withDbRetry(() =>
    db
      .select({
        id: ingestionRuns.id,
        ranAt: ingestionRuns.ranAt,
        trigger: ingestionRuns.trigger,
        status: ingestionRuns.status,
        fetched: ingestionRuns.fetched,
        inserted: ingestionRuns.inserted,
        skipped: ingestionRuns.skipped,
        errors: ingestionRuns.errors,
        durationMs: ingestionRuns.durationMs,
        sourcesJson: ingestionRuns.sourcesJson,
      })
      .from(ingestionRuns)
      .where(where)
      .orderBy(desc(ingestionRuns.id))
      .limit(limit + 1)
      .all(),
  );

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

  return withRateLimitHeaders(
    NextResponse.json({
      runs: page,
      nextCursor,
      pageSize: limit,
    }),
    limitResult,
  );
}

function parseTrigger(value: string | null): IngestionRunTrigger | null {
  if (value === "cron" || value === "admin") return value;
  return null;
}

function parseStatus(value: string | null): IngestionRunStatus | null {
  if (value === "ok" || value === "partial" || value === "failed") return value;
  return null;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
