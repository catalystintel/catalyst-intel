import { defineConfig } from "drizzle-kit";

// "turso" is drizzle-kit's dialect for the libSQL driver, used for both a
// plain local file (dev) and a hosted Turso database (production) - see
// DEPLOYMENT.md.
const url =
  process.env.LIBSQL_URL || process.env.DATABASE_URL || "file:local.db";
const authToken = process.env.LIBSQL_AUTH_TOKEN;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url,
    authToken,
  },
});
