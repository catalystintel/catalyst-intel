import {
  isTursoQuotaBlockedError,
  normalizeDbError,
} from "@/lib/errors/classify-db-error";

/**
 * Turso (hosted libSQL) occasionally drops a request with a transient
 * connection error - a network blip, or the serverless function's first
 * query after a cold start. These are read-only SELECTs, so a same-request
 * retry is safe and turns a one-off blip into an invisible ~250ms delay
 * instead of a full page error (see `src/app/error.tsx`'s classification,
 * which this pattern intentionally mirrors).
 *
 * Turso plan-quota `BLOCKED` errors are never retried — every attempt fails
 * the same way and burns more of an already-exhausted quota.
 */
const TRANSIENT_DB_ERROR_PATTERN =
  /ConnectionFailed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|socket hang up|network|timed? ?out/i;

function isTransientDbError(error: unknown): boolean {
  if (isTursoQuotaBlockedError(error)) return false;
  const message = error instanceof Error ? error.message : String(error);
  return TRANSIENT_DB_ERROR_PATTERN.test(message);
}

/**
 * Runs `fn`, retrying up to `attempts` total times (with a short delay
 * between tries) if it fails with what looks like a transient connection
 * error. Any other error, or the last attempt's error, is rethrown — Turso
 * quota/`BLOCKED` failures are normalized so `error.tsx` can show a clear
 * upgrade message even after Next strips `.cause`.
 */
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  { attempts = 2, delayMs = 250 }: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isTransientDbError(error)) {
        throw normalizeDbError(error);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  // Unreachable given the loop above always returns or throws, but keeps
  // TypeScript happy about the function's return type.
  throw normalizeDbError(lastError);
}
