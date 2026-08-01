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
  pushSubscriptions,
  rawSources,
  watchlistEntries,
  watchlists,
  type WatchlistCriteria,
} from "@/db/schema";
import {
  deliverAlertRules,
  type AlertCatalystPayload,
  type AlertWatchlistCriteriaById,
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
      symbol: catalysts.symbol,
      headline: catalysts.headline,
      title: catalysts.title,
      eventCategory: catalysts.eventCategory,
      impactScore: catalysts.impactScore,
      timestamp: catalysts.timestamp,
      type: catalysts.type,
      companyName: catalysts.companyName,
      sourceUrl: rawSources.url,
      sourceProvider: rawSources.provider,
      tags: catalysts.tags,
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

  // Flat symbols (legacy `watchlistOnly`) + saved criteria (`watchlistIds`).
  const userIds = [...new Set(ruleRows.map((r) => r.userId))];
  const watchlistEntryRows = await db
    .select({
      userId: watchlistEntries.userId,
      symbol: watchlistEntries.symbol,
    })
    .from(watchlistEntries)
    .where(inArray(watchlistEntries.userId, userIds))
    .all();
  const flatSymbolsByUser = new Map<number, string[]>();
  for (const row of watchlistEntryRows) {
    const list = flatSymbolsByUser.get(row.userId) ?? [];
    list.push(row.symbol);
    flatSymbolsByUser.set(row.userId, list);
  }

  const savedWatchlistRows = await db
    .select({
      id: watchlists.id,
      userId: watchlists.userId,
      criteria: watchlists.criteria,
    })
    .from(watchlists)
    .where(inArray(watchlists.userId, userIds))
    .all();
  const criteriaByUser = new Map<number, AlertWatchlistCriteriaById>();
  for (const row of savedWatchlistRows) {
    let map = criteriaByUser.get(row.userId);
    if (!map) {
      map = new Map();
      criteriaByUser.set(row.userId, map);
    }
    map.set(row.id, (row.criteria ?? {}) as WatchlistCriteria);
  }

  // Only fetched for users with at least one push rule — most won't have any.
  const pushUserIds = [
    ...new Set(
      ruleRows.filter((r) => r.channel === "push").map((r) => r.userId),
    ),
  ];
  const subscriptionRows = pushUserIds.length
    ? await db
        .select()
        .from(pushSubscriptions)
        .where(inArray(pushSubscriptions.userId, pushUserIds))
        .all()
    : [];
  const subscriptionsByUser = new Map<number, typeof subscriptionRows>();
  for (const row of subscriptionRows) {
    const list = subscriptionsByUser.get(row.userId) ?? [];
    list.push(row);
    subscriptionsByUser.set(row.userId, list);
  }

  const rulesByUser = new Map<number, DeliverableRule[]>();
  for (const r of ruleRows) {
    const rule: DeliverableRule = {
      id: r.id,
      name: r.name,
      channel: r.channel,
      webhookUrl: r.webhookUrl,
      emailTo: r.emailTo,
      telegramChatId: r.telegramChatId,
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
      symbol: catalyst.symbol,
      headline: catalyst.headline,
      title: catalyst.title,
      eventCategory: catalyst.eventCategory,
      impactScore: catalyst.impactScore,
      timestamp: catalyst.timestamp,
      sourceUrl: catalyst.sourceUrl,
      type: catalyst.type,
      companyName: catalyst.companyName,
      sourceProvider: catalyst.sourceProvider,
      tags: Array.isArray(catalyst.tags)
        ? (catalyst.tags as unknown[]).filter(
            (t): t is string => typeof t === "string",
          )
        : null,
    };

    for (const [userId, userRules] of rulesByUser) {
      const candidateRules = userRules.filter(
        (r) => !alreadyDelivered.has(`${r.id}:${catalyst.id}`),
      );
      if (candidateRules.length === 0) continue;

      const results = await deliverAlertRules({
        catalyst: payload,
        rules: candidateRules,
        watchlistSymbols: flatSymbolsByUser.get(userId) ?? [],
        watchlistCriteriaById: criteriaByUser.get(userId),
        pushSubscriptions: subscriptionsByUser.get(userId) ?? [],
        onDeadPushSubscription: async (endpoint) => {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, endpoint))
            .run();
        },
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
