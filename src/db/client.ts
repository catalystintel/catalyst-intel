import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "./schema";

// Locally this points at a plain file (fully offline, no account needed).
// In production, set LIBSQL_URL/LIBSQL_AUTH_TOKEN to a hosted Turso database
// instead - same libSQL driver, same schema, no code changes required.
// See DEPLOYMENT.md.
const url = process.env.LIBSQL_URL || process.env.DATABASE_URL || "file:local.db";
const authToken = process.env.LIBSQL_AUTH_TOKEN;

const client = createClient({ url, authToken });

export const db = drizzle(client, { schema });
