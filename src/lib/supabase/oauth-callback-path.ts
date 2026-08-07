/**
 * Supabase sometimes returns the PKCE `code` to Site URL (`/`) when Redirect
 * URLs / Site URL are misconfigured. Our exchange only runs on
 * `/auth/callback` — forward stray codes there so sign-in can finish.
 */
export function shouldForwardOAuthCodeToCallback(
  pathname: string,
  searchParams: URLSearchParams,
): boolean {
  if (!searchParams.has("code")) return false;
  if (pathname === "/auth/callback" || pathname.startsWith("/auth/callback/")) {
    return false;
  }
  if (pathname.startsWith("/api/")) return false;
  return true;
}
