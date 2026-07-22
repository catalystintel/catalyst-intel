/**
 * Turso (hosted libSQL) occasionally drops a request with a transient
 * connection error - a network blip, or the serverless function's first
 * query after a cold start. These are read-only SELECTs, so a same-request
 * retry is safe and turns a one-off blip into an invisible ~250ms delay
 * instead of a full page error (see `src/app/error.tsx`'s `looksLikeDb`
 * classification, which this pattern intentionally mirrors).
 */
const TRANSIENT_DB_ERROR_PATTERN =
  /ConnectionFailed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|socket hang up|network|timed? ?out/i;

function isTransientDbError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return TRANSIENT_DB_ERROR_PATTERN.test(message);
}

/**
 * Runs `fn`, retrying up to `attempts` total times (with a short delay
 * between tries) if it fails with what looks like a transient connection
 * error. Any other error, or the last attempt's error, is rethrown as-is.
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
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  // Unreachable given the loop above always returns or throws, but keeps
  // TypeScript happy about the function's return type.
  throw lastError;
}
