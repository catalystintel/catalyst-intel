import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * First-party auth cookie defaults that behave on iOS Safari (ITP).
 * Lax + Secure on HTTPS keeps the PKCE verifier available after the
 * Google → Supabase → /auth/callback top-level redirect chain.
 */
export const supabaseCookieOptions = {
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
} as const satisfies CookieOptionsWithName;
