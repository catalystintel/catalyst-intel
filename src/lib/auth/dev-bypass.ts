import { getAdminEmails } from "./admin";

/**
 * Local-only auth escape hatch so UI work doesn't require a Google OAuth
 * round-trip (which, on localhost, bounces to the deployed Site URL unless the
 * Supabase redirect allowlist is configured).
 *
 * Double-gated on purpose: it is impossible to enable in production because
 * `NODE_ENV` is always "production" on Vercel, so even a stray `DEV_AUTH_BYPASS`
 * env var there is inert.
 *
 * @returns True only when running outside production with the flag set.
 */
export function isDevAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_AUTH_BYPASS === "true"
  );
}

/**
 * Email the bypass session impersonates. Defaults to the first admin so the
 * local session can see the admin console.
 *
 * @returns Lowercased email for the synthetic dev user.
 */
export function getDevBypassEmail(): string {
  const configured = process.env.DEV_AUTH_EMAIL?.trim();
  return (configured || getAdminEmails()[0]).toLowerCase();
}

/**
 * Href for marketing "Sign in" / "Continue with Google" CTAs.
 *
 * With local bypass on: `/login` so the user can pick desk bypass or real
 * Google OAuth. Otherwise: `/auth/login` to start Supabase Google OAuth
 * immediately (same outcome from every CTA).
 *
 * @param next - Post-auth path (re-validated by `/auth/login` / login page).
 */
export function getSignInStartHref(next = "/catalyst-feed"): string {
  const q = `next=${encodeURIComponent(next)}`;
  if (isDevAuthBypassEnabled()) {
    return `/login?${q}`;
  }
  return `/auth/login?${q}`;
}
