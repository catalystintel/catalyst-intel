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
 * Explicit opt-in for wipe/rebuild of ingest tables. Requires both a
 * non-production Vercel env (or local) and `ALLOW_DB_RESET=true` so shared
 * staging Turso is not wiped by accident.
 */
export function isDbResetAllowed(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return isNonProductionEnv(env) && env.ALLOW_DB_RESET === "true";
}
