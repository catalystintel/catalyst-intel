"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getRequestOrigin, safeNextPath } from "@/lib/http/origin";
import { isSupabaseConfigured, SUPABASE_SETUP_HINT } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Google is the only sign-in method - no passwords are ever collected or
 * stored anywhere in this app. Supabase handles the OAuth exchange; our own
 * `users` table only ever stores a Supabase user id, email, role, and
 * subscription tier (see src/db/schema.ts) - never a credential.
 */
export async function signInWithGoogle(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect(`/login?error=${encodeURIComponent(SUPABASE_SETUP_HINT)}`);
  }

  const next = safeNextPath(formData.get("next") as string | null);

  const headerList = await headers();
  let origin: string;
  try {
    origin = getRequestOrigin(headerList);
  } catch {
    redirect(
      `/login?error=${encodeURIComponent("Could not determine app URL for Google sign-in.")}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data?.url) {
    redirect(
      `/login?error=${encodeURIComponent(error?.message ?? "Could not start Google sign-in.")}`,
    );
  }

  redirect(data.url);
}

export async function logout() {
  if (!isSupabaseConfigured()) {
    redirect(`/login?error=${encodeURIComponent(SUPABASE_SETUP_HINT)}`);
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
