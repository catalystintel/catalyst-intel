/**
 * True for local / preview / staging — false only when Vercel Production.
 * `VERCEL_ENV` is unset locally; "preview" on preview deployments; "production"
 * on the production deployment.
 */
export function isNonProductionEnv(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.VERCEL_ENV !== "production";
}

/**
 * Phrase admins must type in the Clear DB confirm dialog (and send in the
 * API body). Exact match, case-sensitive.
 */
export const DB_RESET_CONFIRM_PHRASE = "delete";

/**
 * Clear-DB is available in every environment (including production). Access
 * is gated by interactive admin auth on `/api/admin/reset-db` plus
 * {@link DB_RESET_CONFIRM_PHRASE} — not by env flags.
 */
export function isDbResetAllowed(
  _env: Record<string, string | undefined> = process.env,
): boolean {
  return true;
}
