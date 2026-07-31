import { NextResponse } from "next/server";

import { resolveOAuthRedirectOrigin, safeNextPath } from "@/lib/http/origin";
import {
  canAccessPreviewDeployment,
  isPreviewDeployment,
} from "@/lib/ops/preview-access";
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
  const { searchParams } = new URL(request.url);
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

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // Preview / staging: drop the session immediately for non-admins so a
      // successful Google OAuth cannot leave a usable cookie on the host.
      if (
        isPreviewDeployment() &&
        !canAccessPreviewDeployment(data.user.email)
      ) {
        await supabase.auth.signOut();
        return NextResponse.redirect(
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

      return NextResponse.redirect(`${redirectOrigin}${next}`);
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
    return NextResponse.redirect(
      `${redirectOrigin}/login?error=${encodeURIComponent(detail)}`,
    );
  }

  return NextResponse.redirect(
    `${redirectOrigin}/login?error=${encodeURIComponent("Google sign-in failed. Please try again.")}`,
  );
}
