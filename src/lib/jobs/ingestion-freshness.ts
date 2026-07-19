/**
 * Backstop for unreliable external schedulers (see DEPLOYMENT.md - GitHub
 * Actions cron is best-effort and can drift far past its configured
 * interval). When a read request notices ingested data is older than
 * `STALE_AFTER_MS`, it can trigger a background refetch itself. A cooldown
 * guard prevents concurrent page loads from all firing at once.
 */

const STALE_AFTER_MS = 10 * 60_000;
const RETRIGGER_COOLDOWN_MS = 3 * 60_000;

let lastTriggeredAt: number | null = null;

/** Exposed for tests - clears the in-memory cooldown state. */
export function resetIngestionFreshnessStore(): void {
  lastTriggeredAt = null;
}

/**
 * Decides whether a background refetch should be kicked off right now.
 *
 * @param lastFetchedAt - Timestamp of the most recent successful ingestion
 *   (`null` if the database has never been populated).
 * @param now - Injectable clock for tests; defaults to `Date.now()`.
 * @returns `true` if the caller should trigger `fetchSecEdgar()` and then
 *   call {@link markRefetchTriggered}.
 */
export function shouldTriggerBackgroundRefetch({
  lastFetchedAt,
  now = Date.now(),
}: {
  lastFetchedAt: Date | null;
  now?: number;
}): boolean {
  if (
    lastTriggeredAt !== null &&
    now - lastTriggeredAt < RETRIGGER_COOLDOWN_MS
  ) {
    return false;
  }

  if (lastFetchedAt === null) return true;

  return now - lastFetchedAt.getTime() > STALE_AFTER_MS;
}

/** Records that a background refetch was just triggered, starting the cooldown. */
export function markRefetchTriggered(now = Date.now()): void {
  lastTriggeredAt = now;
}
