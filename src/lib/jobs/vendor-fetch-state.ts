/**
 * Per-vendor ingest watermarks (`vendor_fetch_state`).
 *
 * `last_fetched_at` only advances on success. After a rate-limit (429), the
 * cursor stays put so the next cron tick requests a larger since→now window
 * and does not permanently miss Polygon news that fell out of a fixed
 * "latest N" slice.
 */

import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { vendorFetchState } from "@/db/schema";

export type VendorFetchStatus = "ok" | "error" | "skipped" | "rate_limited";

export type VendorFetchStateRow = {
  sourceId: string;
  lastFetchedAt: string | null;
  lastAttemptAt: string;
  lastStatus: VendorFetchStatus;
  lastMessage: string | null;
};

export async function getVendorFetchState(
  sourceId: string,
): Promise<VendorFetchStateRow | null> {
  const row = await db
    .select({
      sourceId: vendorFetchState.sourceId,
      lastFetchedAt: vendorFetchState.lastFetchedAt,
      lastAttemptAt: vendorFetchState.lastAttemptAt,
      lastStatus: vendorFetchState.lastStatus,
      lastMessage: vendorFetchState.lastMessage,
    })
    .from(vendorFetchState)
    .where(eq(vendorFetchState.sourceId, sourceId))
    .get();

  return row ?? null;
}

/**
 * Upsert vendor state. When `advanceWatermark` is true, sets `last_fetched_at`
 * to `now`. When false (typical after 429), keeps the previous watermark.
 */
export async function touchVendorFetchState(options: {
  sourceId: string;
  status: VendorFetchStatus;
  message?: string | null;
  advanceWatermark: boolean;
  now?: Date;
}): Promise<void> {
  const nowIso = (options.now ?? new Date()).toISOString();
  const existing = await getVendorFetchState(options.sourceId);
  const lastFetchedAt = options.advanceWatermark
    ? nowIso
    : (existing?.lastFetchedAt ?? null);

  await db
    .insert(vendorFetchState)
    .values({
      sourceId: options.sourceId,
      lastFetchedAt,
      lastAttemptAt: nowIso,
      lastStatus: options.status,
      lastMessage: options.message ?? null,
      updatedAt: nowIso,
    })
    .onConflictDoUpdate({
      target: vendorFetchState.sourceId,
      set: {
        lastFetchedAt,
        lastAttemptAt: nowIso,
        lastStatus: options.status,
        lastMessage: options.message ?? null,
        updatedAt: nowIso,
      },
    })
    .run();
}

/** Record outcome from a completed source fetch (orchestrator helper). */
export async function recordVendorFetchFromResult(options: {
  sourceId: string;
  status: "ok" | "skipped" | "error";
  message?: string;
  rateLimited?: boolean;
  now?: Date;
}): Promise<void> {
  if (options.rateLimited) {
    await touchVendorFetchState({
      sourceId: options.sourceId,
      status: "rate_limited",
      message: options.message ?? null,
      advanceWatermark: false,
      now: options.now,
    });
    return;
  }

  if (options.status === "skipped") {
    await touchVendorFetchState({
      sourceId: options.sourceId,
      status: "skipped",
      message: options.message ?? null,
      // Don't invent a watermark for soft-skips (missing API key).
      advanceWatermark: false,
      now: options.now,
    });
    return;
  }

  if (options.status === "error") {
    await touchVendorFetchState({
      sourceId: options.sourceId,
      status: "error",
      message: options.message ?? null,
      advanceWatermark: false,
      now: options.now,
    });
    return;
  }

  await touchVendorFetchState({
    sourceId: options.sourceId,
    status: "ok",
    message: options.message ?? null,
    advanceWatermark: true,
    now: options.now,
  });
}
