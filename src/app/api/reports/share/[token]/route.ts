import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

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
  canAccessPreviewDeployment,
  isPreviewDeployment,
} from "@/lib/ops/preview-access";
import type {
  ReportDetail,
  ReportScope,
  ReportSnapshotItem,
  ReportSummary,
  ReportWindow,
} from "@/lib/reports/types";

/**
 * Share-link endpoint — requires a signed-in session (desk layout already
 * gates the page). On Vercel Preview, allowlisted admins only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `reports-share:${ip}`,
    ...RATE_LIMITS.analyticsRead,
  });
  if (!limitResult.ok) return rateLimitExceededResponse(limitResult);

  const user = await getCurrentAppUser();
  if (!user) {
    return withRateLimitHeaders(
      NextResponse.json({ error: "Not authenticated." }, { status: 401 }),
      limitResult,
    );
  }
  if (isPreviewDeployment() && !canAccessPreviewDeployment(user.email)) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "Preview deployments are admin-only." },
        { status: 403 },
      ),
      limitResult,
    );
  }

  const { token } = await params;
  if (!token || typeof token !== "string" || token.length > 64) {
    return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  }

  const row = await db
    .select()
    .from(savedReports)
    .where(eq(savedReports.shareToken, token))
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
