import { defineConfig } from "drizzle-kit";

const DB_PATH = process.env.DATABASE_URL?.replace(/^file:/, "") || "local.db";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: DB_PATH,
  },
});
