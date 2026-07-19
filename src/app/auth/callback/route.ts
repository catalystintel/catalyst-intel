import { NextResponse } from "next/server";

import { safeNextPath } from "@/lib/http/origin";
import {
  getPostHogClient,
  isPostHogServerConfigured,
} from "@/lib/posthog-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Google OAuth redirects here with a one-time `code` after the user
 * approves sign-in on Google's side. We exchange it for a Supabase session
 * (sets the session cookie) and continue on to wherever they were headed.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const oauthError =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      if (isPostHogServerConfigured()) {
        const posthog = getPostHogClient();
        posthog.capture({
          distinctId: data.user.id,
          event: "user_logged_in",
          properties: { provider: "google" },
        });
        await posthog.flush();
      }

      // Prefer the load-balancer-facing host in production (Vercel).
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";
      if (!isLocal && forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
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

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error?.message ?? "Google sign-in failed.")}`,
    );
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Google sign-in failed. Please try again.")}`,
  );
}
