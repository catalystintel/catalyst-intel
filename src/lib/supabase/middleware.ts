import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isDevAuthBypassEnabled } from "@/lib/auth/dev-bypass";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const PROTECTED_PREFIXES = [
  "/catalyst-feed",
  "/news-feed",
  "/reports",
  "/admin",
  "/profile",
  "/watchlist",
  "/alerts",
  "/analytics",
];

/** Shared report links at `/reports/s/[token]` stay public. */
function isProtectedPath(pathname: string): boolean {
  if (pathname === "/reports/s" || pathname.startsWith("/reports/s/")) {
    return false;
  }
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function updateSession(request: NextRequest) {
  // Local bypass: treat every request as authenticated so protected routes
  // render without an OAuth round-trip. Inert in production (see dev-bypass.ts).
  if (isDevAuthBypassEnabled()) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const isProtected = isProtectedPath(request.nextUrl.pathname);

  // Without real Supabase env vars (e.g. fresh Vercel deploy), skip the
  // client entirely so public pages don't 500. Protected routes still go
  // to /login, which shows the setup banner.
  if (!isSupabaseConfigured()) {
    if (isProtected) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...supabaseCookieOptions,
              ...options,
            }),
          );
        },
      },
    },
  );

  // `getSession()` reads/refreshes the JWT from the cookie locally instead of
  // making a network round-trip to Supabase's auth server the way `getUser()`
  // does. That round-trip (on top of the one `getCurrentAppUser()` already
  // makes with `getUser()` for the real check) was adding real latency to
  // every navigation. Safe here because this redirect is optimistic, not the
  // security boundary - see the module comment and `getCurrentAppUser()`.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (isProtected && !session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
