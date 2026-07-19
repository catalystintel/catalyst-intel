/**
 * Hosted libSQL (Turso) is required on Vercel — serverless has no durable
 * local SQLite file. Locally we accept DATABASE_URL=file:... instead.
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

export const LIBSQL_SETUP_HINT =
  "Database is not configured for this environment. On Vercel, set LIBSQL_URL and LIBSQL_AUTH_TOKEN to a Turso database (see DEPLOYMENT.md), run migrations, and redeploy.";
