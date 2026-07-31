/**
 * Vercel Preview / staging access control.
 *
 * Preview deployments (`VERCEL_ENV=preview`) — including the stable `dev`
 * staging alias — are admin-only. Production stays open to signed-in users.
 * Local (`VERCEL_ENV` unset) is not gated here; use DEV_AUTH_BYPASS as usual.
 */

import { isAdminEmail } from "@/lib/auth/admin";

/** True on Vercel Preview (branch / staging) deployments only. */
export function isPreviewDeployment(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.VERCEL_ENV === "preview";
}

/**
 * Paths that must stay reachable on preview without an admin session
 * (OAuth, health probes, cron/admin self-auth, Telegram webhook).
 */
export function isPreviewAccessExemptPath(pathname: string): boolean {
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname === "/auth" || pathname.startsWith("/auth/")) return true;
  if (pathname === "/api/health" || pathname.startsWith("/api/health/")) {
    return true;
  }
  if (pathname === "/api/admin" || pathname.startsWith("/api/admin/")) {
    return true;
  }
  if (
    pathname === "/api/telegram/webhook" ||
    pathname.startsWith("/api/telegram/webhook/")
  ) {
    return true;
  }
  return false;
}

/**
 * Whether the given verified session email may use a preview deployment.
 */
export function canAccessPreviewDeployment(
  email: string | null | undefined,
): boolean {
  return isAdminEmail(email);
}
