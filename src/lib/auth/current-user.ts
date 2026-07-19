import { isLibsqlConfigured } from "@/db/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

import { isAdminEmail } from "./admin";
import { syncSupabaseUser } from "./sync-user";

export type AppUser = {
  id: number;
  supabaseUserId: string;
  email: string;
  role: "user" | "admin";
  subscription: "free" | "pro";
  createdAt: string;
  /** True when the verified session email is on the admin allowlist. */
  isAdmin: boolean;
  displayName: string | null;
  avatarUrl: string | null;
};

/**
 * Returns the current signed-in user's local app row plus profile fields from
 * the verified Supabase session, or null if there is no active session.
 *
 * Throws when Auth succeeded but the app database is unavailable (common on
 * Vercel before Turso env vars are set) so callers can show a setup UI.
 */
export async function getCurrentAppUser(): Promise<AppUser | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  if (!isLibsqlConfigured()) {
    throw new Error(
      "Database is not configured. Set LIBSQL_URL and LIBSQL_AUTH_TOKEN on Vercel (Turso). See DEPLOYMENT.md.",
    );
  }

  const row = await syncSupabaseUser(user);
  if (!row) {
    return null;
  }

  const meta = user.user_metadata ?? {};
  const displayName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    null;
  const avatarUrl =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;

  return {
    ...row,
    isAdmin: isAdminEmail(user.email),
    displayName,
    avatarUrl,
  };
}
