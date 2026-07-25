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

/** True when a query failed because migrations were never applied. */
export function isSchemaMissingError(err: unknown): boolean {
  let current: unknown = err;
  for (let i = 0; i < 5 && current != null; i++) {
    const msg =
      current instanceof Error
        ? `${current.name} ${current.message}`
        : typeof current === "string"
          ? current
          : String(current);
    if (/no such table/i.test(msg)) return true;
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
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
  "Local SQLite is missing or empty. Run npm run db:migrate to create local.db and apply schema, then restart the dev server.";

/** Environment-aware message for API 503 bodies and setup UI. */
export function databaseSetupHint(): string {
  return databaseSetupMode() === "local"
    ? LOCAL_DB_SETUP_HINT
    : LIBSQL_SETUP_HINT;
}
