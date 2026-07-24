/**
 * Wires alert delivery into ingestion itself: previously alert rules only
 * fired when a user manually clicked "test" (`/api/alert-rules/test`). This
 * evaluates every enabled rule against catalysts inserted since the last
 * orchestrator run and delivers matches automatically — see
 * `fetch-all-sources.ts` post-ingest step.
 *
 * `alert_deliveries` is both the audit trail and the dedup guard: a rule
 * that already delivered for a catalyst is never re-evaluated for delivery,
 * even across retries/soft-failures. Condition-mismatch and push-stub
 * "skips" are intentionally NOT persisted — they're cheap to re-check next
 * run and would otherwise bloat the table with one row per rule x catalyst.
 */

import { eq, gte, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  alertDeliveries,
  alertRules,
  catalysts,
  rawSources,
} from "@/db/schema";
import {
  deliverAlertRules,
  type AlertCatalystPayload,
  type DeliverableRule,
} from "@/lib/alerts/deliver";
import { normalizeAlertConditions } from "@/lib/alerts/normalize";

export interface AutoFireResult {
  evaluated: number;
  delivered: number;
  failed: number;
}

export async function runAlertAutoFire(options: {
  since: string;
}): Promise<AutoFireResult> {
  const catalystRows = await db
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
    .where(gte(catalysts.createdAt, options.since))
    .all();

  if (catalystRows.length === 0) {
    return { evaluated: 0, delivered: 0, failed: 0 };
  }

  const ruleRows = await db
    .select()
    .from(alertRules)
    .where(eq(alertRules.enabled, true))
    .all();

  if (ruleRows.length === 0) {
    return { evaluated: catalystRows.length, delivered: 0, failed: 0 };
  }

  const catalystIds = catalystRows.map((c) => c.id);
  const existing = await db
    .select({
      alertRuleId: alertDeliveries.alertRuleId,
      catalystId: alertDeliveries.catalystId,
    })
    .from(alertDeliveries)
    .where(inArray(alertDeliveries.catalystId, catalystIds))
    .all();
  const alreadyDelivered = new Set(
    existing.map((d) => `${d.alertRuleId}:${d.catalystId}`),
  );

  const rules: DeliverableRule[] = ruleRows.map((r) => ({
    id: r.id,
    name: r.name,
    channel: r.channel,
    webhookUrl: r.webhookUrl,
    emailTo: r.emailTo,
    conditions: normalizeAlertConditions(r.conditions),
  }));

  let delivered = 0;
  let failed = 0;

  for (const catalyst of catalystRows) {
    const candidateRules = rules.filter(
      (r) => !alreadyDelivered.has(`${r.id}:${catalyst.id}`),
    );
    if (candidateRules.length === 0) continue;

    const payload: AlertCatalystPayload = {
      id: catalyst.id,
      ticker: catalyst.ticker,
      headline: catalyst.headline,
      title: catalyst.title,
      eventCategory: catalyst.eventCategory,
      impactScore: catalyst.impactScore,
      timestamp: catalyst.timestamp,
      sourceUrl: catalyst.sourceUrl,
    };

    const results = await deliverAlertRules({
      catalyst: payload,
      rules: candidateRules,
    });

    for (const result of results) {
      // Only persist real delivery attempts (conditions matched); leave
      // condition-mismatches and push stubs un-logged (see file header).
      if (result.skipped) continue;

      if (result.ok) delivered++;
      else failed++;

      await db
        .insert(alertDeliveries)
        .values({
          alertRuleId: result.ruleId,
          catalystId: catalyst.id,
          channel: result.channel,
          status: result.ok ? "sent" : "failed",
          detail: result.detail,
        })
        .run();
    }
  }

  return { evaluated: catalystRows.length, delivered, failed };
}
