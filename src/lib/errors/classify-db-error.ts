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
  if (
    /LIBSQL|Turso|ConnectionFailed|ECONNRESET|ETIMEDOUT|fetch failed|timed? ?out/i.test(
      message,
    )
  ) {
    return "transient";
  }
  return "unknown";
}
