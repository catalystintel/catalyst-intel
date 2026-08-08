import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { resolveOAuthRedirectOrigin, safeNextPath } from "@/lib/http/origin";
import {
  canAccessPreviewDeployment,
  isPreviewDeployment,
} from "@/lib/ops/preview-access";
import {
  getPostHogClient,
  isPostHogServerConfigured,
} from "@/lib/posthog-server";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type PendingCookie = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

/**
 * Google OAuth redirects here with a one-time `code` after the user
 * approves sign-in on Google's side. We exchange it for a Supabase session
 * (sets the session cookie on the redirect response) and continue on to
 * wherever they were headed.
 *
 * Important: cookies must be written onto the redirect `NextResponse`, not
 * only via `cookies()` from `next/headers` — otherwise the session can be
 * dropped on the post-OAuth redirect (especially on mobile Safari).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const oauthError =
    searchParams.get("error_description") ?? searchParams.get("error");
  const redirectOrigin = resolveOAuthRedirectOrigin(request);

  if (oauthError) {
    return NextResponse.redirect(
      `${redirectOrigin}/login?error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${redirectOrigin}/login?error=${encodeURIComponent("Google sign-in failed. Please try again.")}`,
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(
      `${redirectOrigin}/login?error=${encodeURIComponent("Sign-in is temporarily unavailable. Please try again shortly.")}`,
    );
  }

  const pendingCookies: PendingCookie[] = [];
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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  function redirectWithCookies(url: string) {
    const response = NextResponse.redirect(url);
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(
        name,
        value,
        options as Parameters<typeof response.cookies.set>[2],
      );
    });
    return response;
  }

  if (!error && data.user) {
    // Preview / staging: drop the session immediately for non-admins so a
    // successful Google OAuth cannot leave a usable cookie on the host.
    if (
      isPreviewDeployment() &&
      !canAccessPreviewDeployment(data.user.email)
    ) {
      await supabase.auth.signOut();
      return redirectWithCookies(
        `${redirectOrigin}/login?error=${encodeURIComponent("preview_admin_only")}`,
      );
    }

    if (isPostHogServerConfigured()) {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: data.user.id,
        event: "user_logged_in",
        properties: { provider: "google" },
      });
      await posthog.flush();
    }

    return redirectWithCookies(`${redirectOrigin}${next}`);
  }

  if (isPostHogServerConfigured()) {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: "anonymous",
      event: "login_failed",
      properties: {
        provider: "google",
        error_message: error?.message ?? "Unknown error",
      },
    });
    await posthog.flush();
  }

  const detail =
    error?.message ??
    "Google sign-in failed — clear site data for this site and try again.";
  return redirectWithCookies(
    `${redirectOrigin}/login?error=${encodeURIComponent(detail)}`,
  );
}
