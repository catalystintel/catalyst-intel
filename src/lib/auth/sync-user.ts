import type { User } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";

import { assertDatabaseConfigured, db } from "@/db/client";
import { users } from "@/db/schema";
import {
  getPostHogClient,
  isPostHogServerConfigured,
} from "@/lib/posthog-server";

import { adminRoleForEmail } from "./admin";

/**
 * Ensures a Supabase-authenticated user has a matching row in the local
 * SQLite `users` table. Safe to call on every request - it's a cheap upsert.
 *
 * `role` is kept in sync with the JWT email allowlist so the DB column is a
 * cache of admin status, not an independent promotion source of truth.
 */
export async function syncSupabaseUser(supabaseUser: User) {
  assertDatabaseConfigured();

  const email = supabaseUser.email;
  if (!email) {
    throw new Error(
      "Supabase user has no email; cannot sync to local users table.",
    );
  }

  const role = adminRoleForEmail(email);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUser.id))
    .get();

  if (existing) {
    if (existing.role !== role || existing.email !== email) {
      await db
        .update(users)
        .set({ role, email })
        .where(eq(users.supabaseUserId, supabaseUser.id))
        .run();
      return { ...existing, role, email };
    }
    return existing;
  }

  await db
    .insert(users)
    .values({ supabaseUserId: supabaseUser.id, email, role })
    .onConflictDoNothing()
    .run();

  if (isPostHogServerConfigured()) {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: supabaseUser.id,
      event: "user_signed_up",
      properties: { role, subscription: "free" },
    });
    await posthog.flush();
  }

  return db
    .select()
    .from(users)
    .where(eq(users.supabaseUserId, supabaseUser.id))
    .get();
}
