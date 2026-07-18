import type { User } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/db/schema";

/**
 * Ensures a Supabase-authenticated user has a matching row in the local
 * SQLite `users` table. Safe to call on every request - it's a cheap upsert.
 */
export function syncSupabaseUser(supabaseUser: User) {
  const email = supabaseUser.email;
  if (!email) {
    throw new Error("Supabase user has no email; cannot sync to local users table.");
  }

  const existing = db
    .select()
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUser.id))
    .get();

  if (existing) {
    return existing;
  }

  db.insert(users)
    .values({ supabaseUserId: supabaseUser.id, email })
    .onConflictDoNothing()
    .run();

  return db
    .select()
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUser.id))
    .get();
}
