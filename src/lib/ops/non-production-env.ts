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
