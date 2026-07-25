/**
 * Backstop when the primary prod scheduler (cron-job.org →
 * `/api/admin/fetch/all`) gaps or fails. When a read notices ingested data
 * is older than `STALE_AFTER_MS`, it can trigger a background refetch itself.
 * A cooldown guard prevents concurrent page loads from all firing at once.
 *
 * Note: this store is per Vercel isolate — multi-instance spam is reduced by
 * short SEC timeouts + failure cooldown, not eliminated globally.
 */

/** Kick in before the tape is user-visibly stale between cron ticks. */
const STALE_AFTER_MS = 4 * 60_000;

/** Same threshold the Live feed uses for the “stale tape” banner. */
export const INGESTION_STALE_AFTER_MS = STALE_AFTER_MS;
/** Minimum gap between successful trigger attempts in the same isolate. */
const RETRIGGER_COOLDOWN_MS = 3 * 60_000;
/**
 * After a failed background fetch (often ETIMEDOUT from serverless → SEC),
 * wait longer before trying again so logs stay quiet and isolates aren't
 * burned on doomed outbound connects.
 */
const FAILURE_COOLDOWN_MS = 10 * 60_000;

let lastTriggeredAt: number | null = null;
let failureCooldownUntil: number | null = null;
let refetchInFlight = false;

/** Exposed for tests - clears the in-memory cooldown state. */
export function resetIngestionFreshnessStore(): void {
  lastTriggeredAt = null;
  failureCooldownUntil = null;
  refetchInFlight = false;
}

/**
 * Decides whether a background refetch should be kicked off right now.
 * Triggers once ingested data is more than `STALE_AFTER_MS` old.
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
  if (refetchInFlight) return false;

  if (failureCooldownUntil !== null && now < failureCooldownUntil) {
    return false;
  }

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
  refetchInFlight = true;
}

/** Clears the in-flight lock after a successful background refetch. */
export function markRefetchCompleted(): void {
  refetchInFlight = false;
}

/**
 * Clears the in-flight lock and applies a longer cooldown after a failed
 * background refetch (timeouts / SEC unreachable from serverless).
 */
export function markRefetchFailed(now = Date.now()): void {
  refetchInFlight = false;
  lastTriggeredAt = now;
  failureCooldownUntil = now + FAILURE_COOLDOWN_MS;
}
