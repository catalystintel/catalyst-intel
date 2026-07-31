export type DbErrorKind = "not-configured" | "transient" | "quota" | "unknown";

/**
 * Walks `error.cause` so nested libSQL/Turso failures (e.g. drizzle's
 * "Failed query: …" wrapping `LibsqlError: BLOCKED`) are still classifiable.
 */
export function errorMessageChain(err: unknown): string {
  const parts: string[] = [];
  let current: unknown = err;
  for (let i = 0; i < 6 && current != null; i++) {
    if (current instanceof Error) {
      parts.push(`${current.name} ${current.message}`);
      current = current.cause;
      continue;
    }
    if (typeof current === "string") {
      parts.push(current);
      break;
    }
    parts.push(String(current));
    break;
  }
  return parts.join(" | ");
}

/** Turso free/starter monthly quota exhausted — reads/writes return BLOCKED. */
export function isTursoQuotaBlockedError(err: unknown): boolean {
  return /BLOCKED|reads are blocked|SQL read operations are forbidden|upgrade your plan/i.test(
    errorMessageChain(err),
  );
}

/**
 * Stable message for error boundaries. Next.js may strip `.cause` when
 * serializing server errors to the client `error.tsx`, so the classified
 * keywords must live in `Error.message` itself.
 */
/**
 * Stable classifier keywords (`BLOCKED`, quota) must stay in the message so
 * `error.tsx` can still classify after Next strips `.cause`. Copy stays
 * trader-safe — no Turso/docs/ops links.
 */
export const TURSO_QUOTA_BLOCKED_MESSAGE =
  "Database quota exceeded (BLOCKED): SQL reads are blocked until capacity is restored.";

export function normalizeDbError(err: unknown): Error {
  if (isTursoQuotaBlockedError(err)) {
    return new Error(TURSO_QUOTA_BLOCKED_MESSAGE, { cause: err });
  }
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * Classifies a thrown error's message for `src/app/error.tsx`.
 *
 * "not-configured" (missing/invalid `LIBSQL_URL` - see `db/client.ts` and
 * `assertDatabaseConfigured`) is a setup problem; reloading won't help. A
 * "transient" error from an otherwise-configured Turso database (a
 * cold-start blip, brief network hiccup, etc.) is different - the env vars
 * are fine, and reloading (or `withDbRetry`'s automatic retry, for the
 * queries that use it) is likely to succeed. "quota" is Turso plan limits
 * (BLOCKED) — also not fixed by reload; needs a plan upgrade or month reset.
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
  // Monthly Turso quota — BLOCKED on every SQL read until upgrade/reset.
  if (
    /BLOCKED|reads are blocked|SQL read operations are forbidden|quota exceeded|upgrade your plan/i.test(
      message,
    )
  ) {
    return "quota";
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
