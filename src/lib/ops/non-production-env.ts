/**
 * True for local / preview / staging — false only when Vercel Production.
 * `VERCEL_ENV` is unset locally; "preview" on preview deployments; "production"
 * on the production deployment. Used to gate destructive admin ops.
 */
export function isNonProductionEnv(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.VERCEL_ENV !== "production";
}

/**
 * Wipe/rebuild of ingest tables:
 * - Production: never.
 * - Local (`VERCEL_ENV` unset): always — only hits `local.db`.
 * - Preview/staging: requires `ALLOW_DB_RESET=true` so shared Turso is not
 *   wiped by accident.
 */
export function isDbResetAllowed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!isNonProductionEnv(env)) return false;
  if (!env.VERCEL_ENV) return true;
  return env.ALLOW_DB_RESET === "true";
}
