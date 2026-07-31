import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { savedReports } from "@/db/schema";
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
import type {
  ReportDetail,
  ReportScope,
  ReportSnapshotItem,
  ReportSummary,
  ReportWindow,
} from "@/lib/reports/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentAppUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `reports-get:${ip}`,
    ...RATE_LIMITS.analyticsRead,
  });
  if (!limitResult.ok) return rateLimitExceededResponse(limitResult);

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid report ID." }, { status: 400 });
  }

  const row = await db
    .select()
    .from(savedReports)
    .where(and(eq(savedReports.id, id), eq(savedReports.userId, user.id)))
    .get();

  if (!row) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const summary: ReportSummary = {
    id: row.id,
    title: row.title,
    window: row.window as ReportWindow,
    scope: row.scope as ReportScope,
    shareToken: row.shareToken,
    itemCount: row.itemCount,
    createdAt: row.createdAt,
  };

  const items = Array.isArray(row.itemsJson)
    ? (row.itemsJson as ReportSnapshotItem[])
    : [];

  const report: ReportDetail = { ...summary, items };

  return withRateLimitHeaders(NextResponse.json({ report }), limitResult);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return sameOriginForbiddenResponse();
  }

  const user = await getCurrentAppUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `reports-delete:${ip}:${user.id}`,
    ...RATE_LIMITS.userWrite,
  });
  if (!limitResult.ok) return rateLimitExceededResponse(limitResult);

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid report ID." }, { status: 400 });
  }

  const deleted = await db
    .delete(savedReports)
    .where(and(eq(savedReports.id, id), eq(savedReports.userId, user.id)))
    .returning({ id: savedReports.id });

  if (deleted.length === 0) {
    return NextResponse.json(
      { error: "Report not found or not owned by you." },
      { status: 404 },
    );
  }

  return withRateLimitHeaders(NextResponse.json({ ok: true }), limitResult);
}
