/**
 * Ops usage stats for the admin panel — delivery volume vs soft caps.
 * Sourced from `alert_deliveries` (no extra instrumentation table).
 */

import { and, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  alertDeliveries,
  vendorFetchState,
  type AlertChannel,
} from "@/db/schema";
import { RATE_LIMITS } from "@/lib/http/rate-limit";
import { isResendConfigured } from "@/lib/email/resend";
import { isTelegramConfigured } from "@/lib/telegram/bot";
import { isWebPushConfigured } from "@/lib/push/web-push";
import { isOpenRouterConfigured } from "@/lib/jobs/llm-provider";

export type ChannelUsageBucket = {
  channel: AlertChannel;
  sent24h: number;
  failed24h: number;
  sent7d: number;
  failed7d: number;
  softDailyLimit: number | null;
};

export type UsageStats = {
  generatedAt: string;
  channels: ChannelUsageBucket[];
  vendorsRateLimited: number;
  softLimits: {
    emailDaily: number;
    note: string;
  };
  configured: {
    email: boolean;
    telegram: boolean;
    push: boolean;
    openRouter: boolean;
  };
  appRateLimits: {
    key: string;
    limit: number;
    windowMs: number;
  }[];
};

function softEmailDailyLimit(): number {
  const raw = process.env.EMAIL_DAILY_SOFT_LIMIT?.trim();
  const n = raw ? Number(raw) : 100;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 100;
}

function sinceIso(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString();
}

async function countDeliveries(options: {
  channel: AlertChannel;
  status: "sent" | "failed";
  sinceIso: string;
}): Promise<number> {
  const row = await db
    .select({ value: sql<number>`count(*)` })
    .from(alertDeliveries)
    .where(
      and(
        eq(alertDeliveries.channel, options.channel),
        eq(alertDeliveries.status, options.status),
        gte(alertDeliveries.createdAt, options.sinceIso),
      ),
    )
    .get();
  return Number(row?.value ?? 0);
}

export async function getUsageStats(): Promise<UsageStats> {
  const day = sinceIso(24 * 60 * 60_000);
  const week = sinceIso(7 * 24 * 60 * 60_000);
  const emailDaily = softEmailDailyLimit();

  const channels: ChannelUsageBucket[] = [];
  for (const channel of ["email", "telegram", "push", "webhook"] as const) {
    const [sent24h, failed24h, sent7d, failed7d] = await Promise.all([
      countDeliveries({ channel, status: "sent", sinceIso: day }),
      countDeliveries({ channel, status: "failed", sinceIso: day }),
      countDeliveries({ channel, status: "sent", sinceIso: week }),
      countDeliveries({ channel, status: "failed", sinceIso: week }),
    ]);
    channels.push({
      channel,
      sent24h,
      failed24h,
      sent7d,
      failed7d,
      softDailyLimit: channel === "email" ? emailDaily : null,
    });
  }

  const rateLimitedRow = await db
    .select({ value: sql<number>`count(*)` })
    .from(vendorFetchState)
    .where(eq(vendorFetchState.lastStatus, "rate_limited"))
    .get();

  return {
    generatedAt: new Date().toISOString(),
    channels,
    vendorsRateLimited: Number(rateLimitedRow?.value ?? 0),
    softLimits: {
      emailDaily,
      note: "Email soft cap defaults to 100/day (typical Resend free-tier order of magnitude). Override with EMAIL_DAILY_SOFT_LIMIT.",
    },
    configured: {
      email: isResendConfigured(),
      telegram: isTelegramConfigured(),
      push: isWebPushConfigured(),
      openRouter: isOpenRouterConfigured(),
    },
    appRateLimits: (
      Object.entries(RATE_LIMITS) as [
        string,
        { limit: number; windowMs: number },
      ][]
    ).map(([key, v]) => ({
      key,
      limit: v.limit,
      windowMs: v.windowMs,
    })),
  };
}
