import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";

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
  buildReportSnapshot,
  createShareToken,
  defaultReportTitle,
} from "@/lib/reports/build-snapshot";
import {
  REPORT_SCOPE_VALUES,
  REPORT_WINDOW_VALUES,
  type ReportScope,
  type ReportWindow,
} from "@/lib/reports/types";
import type { ReportSummary } from "@/lib/reports/types";

export async function GET(request: NextRequest) {
  const user = await getCurrentAppUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `reports-list:${ip}`,
    ...RATE_LIMITS.analyticsRead,
  });
  if (!limitResult.ok) return rateLimitExceededResponse(limitResult);

  const rows = await db
    .select({
      id: savedReports.id,
      title: savedReports.title,
      window: savedReports.window,
      scope: savedReports.scope,
      shareToken: savedReports.shareToken,
      itemCount: savedReports.itemCount,
      createdAt: savedReports.createdAt,
    })
    .from(savedReports)
    .where(eq(savedReports.userId, user.id))
    .orderBy(desc(savedReports.createdAt))
    .all();

  const reports: ReportSummary[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    window: r.window as ReportWindow,
    scope: r.scope as ReportScope,
    shareToken: r.shareToken,
    itemCount: r.itemCount,
    createdAt: r.createdAt,
  }));

  return withRateLimitHeaders(NextResponse.json({ reports }), limitResult);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentAppUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `reports-create:${ip}:${user.id}`,
    ...RATE_LIMITS.userWrite,
  });
  if (!limitResult.ok) return rateLimitExceededResponse(limitResult);

  let body: { window?: unknown; scope?: unknown; title?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const window = body.window as string;
  const scope = body.scope as string;

  if (!REPORT_WINDOW_VALUES.includes(window as ReportWindow)) {
    return NextResponse.json(
      { error: `window must be one of ${REPORT_WINDOW_VALUES.join(", ")}.` },
      { status: 400 },
    );
  }
  if (!REPORT_SCOPE_VALUES.includes(scope as ReportScope)) {
    return NextResponse.json(
      { error: `scope must be one of ${REPORT_SCOPE_VALUES.join(", ")}.` },
      { status: 400 },
    );
  }

  const reportWindow = window as ReportWindow;
  const reportScope = scope as ReportScope;
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 120)
      : defaultReportTitle(reportWindow, reportScope);

  const items = await buildReportSnapshot(user.id, reportWindow, reportScope);
  const shareToken = createShareToken();

  const [inserted] = await db
    .insert(savedReports)
    .values({
      userId: user.id,
      title,
      window: reportWindow,
      scope: reportScope,
      shareToken,
      itemCount: items.length,
      itemsJson: items,
    })
    .returning({
      id: savedReports.id,
      title: savedReports.title,
      window: savedReports.window,
      scope: savedReports.scope,
      shareToken: savedReports.shareToken,
      itemCount: savedReports.itemCount,
      createdAt: savedReports.createdAt,
    });

  if (!inserted) {
    return NextResponse.json(
      { error: "Failed to save report." },
      { status: 500 },
    );
  }

  const report: ReportSummary = {
    id: inserted.id,
    title: inserted.title,
    window: inserted.window as ReportWindow,
    scope: inserted.scope as ReportScope,
    shareToken: inserted.shareToken,
    itemCount: inserted.itemCount,
    createdAt: inserted.createdAt,
  };

  return withRateLimitHeaders(
    NextResponse.json({ report, items }, { status: 201 }),
    limitResult,
  );
}
