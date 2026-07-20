"use server";

import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/http/origin";
import { isSupabaseConfigured, SUPABASE_SETUP_HINT } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Google is the only sign-in method - no passwords are ever collected or
 * stored anywhere in this app. Prefer the browser button or GET /auth/login
 * (cookie-safe on iOS Safari). This action remains as a thin redirect for
 * any legacy form posts.
 */
export async function signInWithGoogle(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect(`/login?error=${encodeURIComponent(SUPABASE_SETUP_HINT)}`);
  }

  const next = safeNextPath(formData.get("next") as string | null);
  redirect(`/auth/login?next=${encodeURIComponent(next)}`);
}

/** Clears the current browser session (this device). */
export async function logout() {
  if (!isSupabaseConfigured()) {
    redirect(`/login?error=${encodeURIComponent(SUPABASE_SETUP_HINT)}`);
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}

/**
 * Signs out of every device/session for this account via Supabase.
 * This does not delete the Google account or unlink the OAuth identity.
 */
export async function signOutEverywhere() {
  if (!isSupabaseConfigured()) {
    redirect(`/login?error=${encodeURIComponent(SUPABASE_SETUP_HINT)}`);
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/");
}
