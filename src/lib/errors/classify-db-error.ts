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
  // file: URLs / web-client scheme errors mean the DB module leaked into a
  // browser/edge bundle or Turso env is missing — not a transient blip.
  if (
    /local\.db|Database is not configured|URL_SCHEME_NOT_SUPPORTED|got ['"]file:/i.test(
      message,
    )
  ) {
    return "not-configured";
  }
  // Vercel Hobby function timeouts used to match a bare `timeout` pattern and
  // get mislabeled as a Turso outage.
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
