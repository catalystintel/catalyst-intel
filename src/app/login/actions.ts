"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Google is the only sign-in method - no passwords are ever collected or
 * stored anywhere in this app. Supabase handles the OAuth exchange; our own
 * `users` table only ever stores a Supabase user id, email, role, and
 * subscription tier (see src/db/schema.ts) - never a credential.
 */
export async function signInWithGoogle(formData: FormData) {
  const next = (formData.get("next") as string) || "/dashboard";

  const headerList = await headers();
  const origin = headerList.get("origin") ?? `https://${headerList.get("host")}`;

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
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
