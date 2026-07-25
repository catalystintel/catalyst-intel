import "server-only";

import fs from "node:fs";
import path from "node:path";

import { databaseSetupMode, localSqlitePath } from "@/db/env";

/**
 * Local-only gate: missing or 0-byte `local.db` must not count as ready.
 * Kept out of {@link ./env} so App Route NFT tracing doesn't pull `fs` + cwd
 * into every API bundle.
 */
export function isLocalSqliteReady(): boolean {
  if (databaseSetupMode() !== "local") return true;

  const databaseUrl = process.env.DATABASE_URL ?? "file:local.db";
  const relative = localSqlitePath(databaseUrl);
  if (relative == null) return false;

  const filePath = path.isAbsolute(relative)
    ? relative
    : path.join(/* turbopackIgnore: true */ process.cwd(), relative);

  try {
    const st = fs.statSync(filePath);
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}
