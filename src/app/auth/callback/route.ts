import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPostHogClient } from "@/lib/posthog-server";

/**
 * Google OAuth redirects here with a one-time `code` after the user
 * approves sign-in on Google's side. We exchange it for a Supabase session
 * (sets the session cookie) and continue on to wherever they were headed.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: data.user.id,
        event: "user_logged_in",
        properties: { provider: "google" },
      });
      await posthog.flush();
      return NextResponse.redirect(`${origin}${next}`);
    }
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: "anonymous",
      event: "login_failed",
      properties: { provider: "google", error_message: error?.message ?? "Unknown error" },
    });
    await posthog.flush();
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Google sign-in failed. Please try again.")}`,
  );
}
