/**
 * Hosted libSQL (Turso) is required on Vercel — serverless has no durable
 * local SQLite file. Locally we accept DATABASE_URL=file:... instead.
 *
 * Note: a `file:` URL alone does not mean the schema is applied. Desk layout
 * also checks {@link ./local-sqlite-ready} so a 0-byte local.db cannot crash
 * the whole authenticated shell.
 */
export function isLibsqlConfigured(): boolean {
  const libsqlUrl = process.env.LIBSQL_URL ?? "";
  const authToken = process.env.LIBSQL_AUTH_TOKEN ?? "";

  if (isRemoteLibsqlUrl(libsqlUrl)) {
    return authToken.length > 0;
  }

  // Vercel (and similar) cannot use a local file database.
  if (process.env.VERCEL) {
    return false;
  }

  const databaseUrl = process.env.DATABASE_URL ?? "file:local.db";
  return databaseUrl.startsWith("file:");
}

function isRemoteLibsqlUrl(url: string): boolean {
  return (
    url.startsWith("libsql://") ||
    url.startsWith("https://") ||
    url.startsWith("wss://")
  );
}

/** Resolve `file:./local.db` / `file:local.db` to an absolute path. */
export function localSqlitePath(databaseUrl: string): string | null {
  if (!databaseUrl.startsWith("file:")) return null;
  let raw = databaseUrl.slice("file:".length);
  // file:///abs/path → /abs/path
  if (raw.startsWith("///")) {
    raw = raw.slice(2);
  } else if (raw.startsWith("//localhost/")) {
    raw = raw.slice("//localhost".length);
  }
  return raw;
}

function errorMessageChain(err: unknown): string {
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

/** True when a query failed because migrations were never applied. */
export function isSchemaMissingError(err: unknown): boolean {
  return /no such table/i.test(errorMessageChain(err));
}

/**
 * True when local SQLite refused a write (stale Next handle after
 * `rm local.db` / migrate, or a read-only / locked file).
 */
export function isLocalSqliteWriteError(err: unknown): boolean {
  return /SQLITE_READONLY|attempt to write a readonly database|database is locked|SQLITE_BUSY/i.test(
    errorMessageChain(err),
  );
}

/** Desk-layout catch-all for local DB problems that should not 500 the shell. */
export function isLocalSqliteSetupError(err: unknown): boolean {
  return isSchemaMissingError(err) || isLocalSqliteWriteError(err);
}

/** Local file DB vs hosted Turso — drives setup-notice copy. */
export function databaseSetupMode(): "local" | "remote" {
  if (process.env.VERCEL) return "remote";
  const libsqlUrl = process.env.LIBSQL_URL ?? "";
  if (isRemoteLibsqlUrl(libsqlUrl)) return "remote";
  return "local";
}

export const LIBSQL_SETUP_HINT =
  "Database is not configured for this environment. On Vercel, set LIBSQL_URL and LIBSQL_AUTH_TOKEN to a Turso database (see DEPLOYMENT.md), run migrations, and redeploy.";

export const LOCAL_DB_SETUP_HINT =
  "Local SQLite is missing, empty, or not writable. Run npm run db:migrate, then fully restart npm run dev (stop every Next process first — recreating local.db while Next is running often leaves SQLITE_READONLY).";

/** Environment-aware message for API 503 bodies and setup UI. */
export function databaseSetupHint(): string {
  return databaseSetupMode() === "local"
    ? LOCAL_DB_SETUP_HINT
    : LIBSQL_SETUP_HINT;
}
