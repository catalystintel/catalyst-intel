import { isLibsqlConfigured } from "@/db/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { syncSupabaseUser } from "./sync-user";

/**
 * Returns the current signed-in user's local app row (id, email, role, ...),
 * or null if there is no active Supabase session.
 *
 * Throws when Auth succeeded but the app database is unavailable (common on
 * Vercel before Turso env vars are set) so callers can show a setup UI.
 */
export async function getCurrentAppUser() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  if (!isLibsqlConfigured()) {
    throw new Error(
      "Database is not configured. Set LIBSQL_URL and LIBSQL_AUTH_TOKEN on Vercel (Turso). See DEPLOYMENT.md.",
    );
  }

  return (await syncSupabaseUser(user)) ?? null;
}
