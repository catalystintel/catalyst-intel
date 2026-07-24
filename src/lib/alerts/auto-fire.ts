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
  watchlistEntries,
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

  // Watchlists keyed by user — needed for `watchlistOnly` conditions.
  const userIds = [...new Set(ruleRows.map((r) => r.userId))];
  const watchlistRows = await db
    .select({
      userId: watchlistEntries.userId,
      ticker: watchlistEntries.ticker,
    })
    .from(watchlistEntries)
    .where(inArray(watchlistEntries.userId, userIds))
    .all();
  const watchlistsByUser = new Map<number, string[]>();
  for (const row of watchlistRows) {
    const list = watchlistsByUser.get(row.userId) ?? [];
    list.push(row.ticker);
    watchlistsByUser.set(row.userId, list);
  }

  const rulesByUser = new Map<number, DeliverableRule[]>();
  for (const r of ruleRows) {
    const rule: DeliverableRule = {
      id: r.id,
      name: r.name,
      channel: r.channel,
      webhookUrl: r.webhookUrl,
      emailTo: r.emailTo,
      conditions: normalizeAlertConditions(r.conditions),
    };
    const list = rulesByUser.get(r.userId) ?? [];
    list.push(rule);
    rulesByUser.set(r.userId, list);
  }

  let delivered = 0;
  let failed = 0;

  for (const catalyst of catalystRows) {
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

    for (const [userId, userRules] of rulesByUser) {
      const candidateRules = userRules.filter(
        (r) => !alreadyDelivered.has(`${r.id}:${catalyst.id}`),
      );
      if (candidateRules.length === 0) continue;

      const results = await deliverAlertRules({
        catalyst: payload,
        rules: candidateRules,
        watchlistTickers: watchlistsByUser.get(userId) ?? [],
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
  }

  return { evaluated: catalystRows.length, delivered, failed };
}
