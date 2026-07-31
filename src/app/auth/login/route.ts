import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { getRequestOrigin, safeNextPath } from "@/lib/http/origin";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";
import { isSupabaseConfigured, SUPABASE_UNAVAILABLE_MESSAGE } from "@/lib/supabase/env";

/**
 * Starts Google OAuth via a Route Handler so PKCE cookies are attached to the
 * same Set-Cookie + Location response. Server Actions + redirect() can drop
 * those cookies on iOS Safari / in-app browsers, which then fails at
 * /auth/callback and looks like “cannot enter the app”.
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (!isSupabaseConfigured()) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("error", SUPABASE_UNAVAILABLE_MESSAGE);
    return NextResponse.redirect(login);
  }

  let origin: string;
  try {
    origin = getRequestOrigin(request.headers);
  } catch {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set(
      "error",
      "Could not determine app URL for Google sign-in.",
    );
    return NextResponse.redirect(login);
  }

  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const pendingCookies: {
    name: string;
    value: string;
    options: Record<string, unknown>;
  }[] = [];

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
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push({
              name,
              value,
              options: { ...supabaseCookieOptions, ...options },
            });
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    const login = new URL("/login", origin);
    login.searchParams.set(
      "error",
      error?.message ?? "Could not start Google sign-in.",
    );
    return NextResponse.redirect(login);
  }

  const response = NextResponse.redirect(data.url);
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(
      name,
      value,
      options as Parameters<typeof response.cookies.set>[2],
    );
  });
  return response;
}
