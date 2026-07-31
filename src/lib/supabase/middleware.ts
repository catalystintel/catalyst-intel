import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isDevAuthBypassEnabled } from "@/lib/auth/dev-bypass";
import {
  canAccessPreviewDeployment,
  isPreviewAccessExemptPath,
  isPreviewDeployment,
} from "@/lib/ops/preview-access";
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

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function previewAdminDeniedResponse(request: NextRequest): NextResponse {
  const acceptsJson = request.headers
    .get("accept")
    ?.toLowerCase()
    .includes("application/json");
  const isApi = request.nextUrl.pathname.startsWith("/api/");

  if (isApi || acceptsJson) {
    return NextResponse.json(
      { error: "Preview deployments are admin-only." },
      { status: 403 },
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  loginUrl.searchParams.set("error", "preview_admin_only");
  return NextResponse.redirect(loginUrl);
}

export async function updateSession(request: NextRequest) {
  // Local bypass: treat every request as authenticated so protected routes
  // render without an OAuth round-trip. Inert in production (see dev-bypass.ts).
  if (isDevAuthBypassEnabled()) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;
  const isProtected = isProtectedPath(pathname);
  const previewGate =
    isPreviewDeployment() && !isPreviewAccessExemptPath(pathname);

  // Without real Supabase env vars (e.g. fresh Vercel deploy), skip the
  // client entirely so public pages don't 500. Protected routes still go
  // to /login, which shows the setup banner.
  if (!isSupabaseConfigured()) {
    if (isProtected || previewGate) {
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

  if (previewGate) {
    if (!session) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!canAccessPreviewDeployment(session.user.email)) {
      return previewAdminDeniedResponse(request);
    }
  }

  if (isProtected && !session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
