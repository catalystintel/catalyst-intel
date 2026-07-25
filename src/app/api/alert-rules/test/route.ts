import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";

import { databaseSetupHint, isLibsqlConfigured } from "@/db/env";
import { db } from "@/db/client";
import { alertRules, catalysts, rawSources } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { deliverAlertRules, type DeliverableRule } from "@/lib/alerts/deliver";
import { normalizeAlertConditions } from "@/lib/alerts/normalize";
import { getClientIp } from "@/lib/http/client-ip";
import { RATE_LIMITS, checkRateLimit } from "@/lib/http/rate-limit";
import {
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@/lib/http/rate-limit-response";

/**
 * Test-fires alert rules against the latest catalyst (or a specific id).
 * Admins can force-fire any user's rules via ?all=1; normal users fire own rules.
 */
export async function POST(request: NextRequest) {
  if (!isLibsqlConfigured()) {
    return NextResponse.json({ error: databaseSetupHint() }, { status: 503 });
  }

  const ip = getClientIp(request);
  const limitResult = checkRateLimit({
    key: `alert-test:${ip}`,
    ...RATE_LIMITS.alertTest,
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

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const raw =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  const ruleId =
    typeof raw.ruleId === "number"
      ? raw.ruleId
      : typeof raw.ruleId === "string"
        ? Number(raw.ruleId)
        : null;
  const catalystId =
    typeof raw.catalystId === "number"
      ? raw.catalystId
      : typeof raw.catalystId === "string"
        ? Number(raw.catalystId)
        : null;
  const force = raw.force !== false;

  const catalystRow = catalystId
    ? await db
        .select({
          id: catalysts.id,
          ticker: catalysts.ticker,
          headline: catalysts.headline,
          title: catalysts.title,
          eventCategory: catalysts.eventCategory,
          impactScore: catalysts.impactScore,
          timestamp: catalysts.timestamp,
          sourceUrl: rawSources.url,
        })
        .from(catalysts)
        .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
        .where(eq(catalysts.id, catalystId))
        .get()
    : await db
        .select({
          id: catalysts.id,
          ticker: catalysts.ticker,
          headline: catalysts.headline,
          title: catalysts.title,
          eventCategory: catalysts.eventCategory,
          impactScore: catalysts.impactScore,
          timestamp: catalysts.timestamp,
          sourceUrl: rawSources.url,
        })
        .from(catalysts)
        .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
        .orderBy(desc(catalysts.timestamp))
        .limit(1)
        .get();

  if (!catalystRow) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "No catalyst available to test against." },
        { status: 404 },
      ),
      limitResult,
    );
  }

  let ruleRows = await db
    .select()
    .from(alertRules)
    .where(eq(alertRules.userId, user.id))
    .all();

  if (ruleId && Number.isFinite(ruleId)) {
    ruleRows = ruleRows.filter((r) => r.id === ruleId);
  }

  if (ruleRows.length === 0) {
    return withRateLimitHeaders(
      NextResponse.json(
        { error: "No matching alert rules to fire." },
        { status: 404 },
      ),
      limitResult,
    );
  }

  const deliverable: DeliverableRule[] = ruleRows
    .filter((r) => r.enabled)
    .map((r) => ({
      id: r.id,
      name: r.name,
      channel: r.channel,
      webhookUrl: r.webhookUrl,
      emailTo: r.emailTo,
      conditions: normalizeAlertConditions(r.conditions),
    }));

  const results = await deliverAlertRules({
    catalyst: catalystRow,
    rules: deliverable,
    force,
  });

  return withRateLimitHeaders(
    NextResponse.json({
      catalystId: catalystRow.id,
      results,
    }),
    limitResult,
  );
}
