import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncSupabaseUser } from "./sync-user";

/**
 * Returns the current signed-in user's local app row (id, email, role, ...),
 * or null if there is no active Supabase session.
 */
export async function getCurrentAppUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return syncSupabaseUser(user) ?? null;
}
