import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { isLibsqlConfigured } from "./env";
import * as schema from "./schema";

// Locally this points at a plain file (fully offline, no account needed).
// On Vercel, set LIBSQL_URL/LIBSQL_AUTH_TOKEN to a hosted Turso database
// instead - same libSQL driver, same schema. See DEPLOYMENT.md.
function resolveDatabaseUrl(): string {
  const libsqlUrl = process.env.LIBSQL_URL;
  if (libsqlUrl) return libsqlUrl;

  // Never fall back to a local SQLite file on Vercel - the filesystem is
  // ephemeral and createClient("file:local.db") crashes the dashboard.
  if (process.env.VERCEL) {
    return "libsql://configure-turso-see-deployment-md.invalid";
  }

  return process.env.DATABASE_URL || "file:local.db";
}

const url = resolveDatabaseUrl();
const authToken = process.env.LIBSQL_AUTH_TOKEN;

const client = createClient({ url, authToken });

export const db = drizzle(client, { schema });

/** Prefer this before any query so missing Turso env fails with a clear UI. */
export function assertDatabaseConfigured(): void {
  if (!isLibsqlConfigured()) {
    throw new Error(
      "Database is not configured. Set LIBSQL_URL and LIBSQL_AUTH_TOKEN on Vercel (Turso). See DEPLOYMENT.md.",
    );
  }
}
