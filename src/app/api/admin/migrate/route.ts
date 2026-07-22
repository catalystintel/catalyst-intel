import path from "node:path";

import { migrate } from "drizzle-orm/libsql/migrator";
import { type NextRequest } from "next/server";

import { db } from "@/db/client";
import { authorizeAdminFetch, jsonWithAuth } from "@/lib/auth/admin-fetch";

/**
 * Applies any pending drizzle migrations against the current environment's
 * database on demand. Normally migrations already run automatically as part
 * of `npm run build` (see package.json + DEPLOYMENT.md) on every Vercel
 * deploy, so this is a manual "catch up now" control for cases like a
 * hotfixed schema change or a build that shipped before its migration ran.
 * Safe to call repeatedly - drizzle tracks applied migrations and skips them.
 */
export async function POST(request: NextRequest) {
  const auth = await authorizeAdminFetch(request, "admin-migrate");
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const migrationsFolder = path.join(process.cwd(), "drizzle");
    await migrate(db, { migrationsFolder });
    return jsonWithAuth(auth, {
      ok: true,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Migration failed.";
    return jsonWithAuth(auth, { error: message }, { status: 500 });
  }
}
