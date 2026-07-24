export type DbErrorKind = "not-configured" | "transient" | "unknown";

/**
 * Classifies a thrown error's message for `src/app/error.tsx`.
 *
 * "not-configured" (missing/invalid `LIBSQL_URL` - see `db/client.ts` and
 * `assertDatabaseConfigured`) is a setup problem; reloading won't help. A
 * "transient" error from an otherwise-configured Turso database (a
 * cold-start blip, brief network hiccup, etc.) is different - the env vars
 * are fine, and reloading (or `withDbRetry`'s automatic retry, for the
 * queries that use it) is likely to succeed. Telling an admin to
 * reconfigure env vars that are already correct wastes their time chasing
 * a phantom setup issue, so the two cases get distinct copy.
 */
export function classifyDbError(message: string): DbErrorKind {
  if (/local\.db|Database is not configured/i.test(message)) {
    return "not-configured";
  }
  // Vercel Hobby function timeouts ("Task timed out after 10 seconds") used
  // to match a bare `timeout` pattern and get mislabeled as a Turso outage.
  // Keep those as unknown so ops look at function budget, not env vars.
  if (
    /FUNCTION_INVOCATION_TIMEOUT|Task timed out after|RUNTIME_TIMEOUT/i.test(
      message,
    )
  ) {
    return "unknown";
  }
  if (
    /LIBSQL|Turso|ConnectionFailed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|socket hang up/i.test(
      message,
    )
  ) {
    return "transient";
  }
  return "unknown";
}
