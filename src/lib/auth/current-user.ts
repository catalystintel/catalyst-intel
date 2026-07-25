import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { isLibsqlConfigured, isSchemaMissingError } from "@/db/env";
import { users } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

import { adminRoleForEmail, isAdminEmail } from "./admin";
import { getDevBypassEmail, isDevAuthBypassEnabled } from "./dev-bypass";
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
  if (isDevAuthBypassEnabled()) {
    return getDevBypassAppUser();
  }

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
  const googleName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    null;
  // User-chosen name wins; Google's name is the fallback.
  const displayName = row.displayName ?? googleName;
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

/**
 * Builds a DB-backed app user for the local dev bypass, upserting a `users` row
 * so profile edits and foreign keys behave like a real session.
 *
 * @returns The synthetic dev user.
 * @throws When the local database is not configured (bypass needs a real DB).
 */
async function getDevBypassAppUser(): Promise<AppUser> {
  if (!isLibsqlConfigured()) {
    throw new Error(
      "DEV_AUTH_BYPASS is on but the database is not configured. Set DATABASE_URL in .env.local.",
    );
  }

  const email = getDevBypassEmail();
  const supabaseUserId = `dev-bypass:${email}`;
  const role = adminRoleForEmail(email);

  try {
    await db
      .insert(users)
      .values({ supabaseUserId, email, role })
      .onConflictDoNothing()
      .run();

    const row = await db
      .select()
      .from(users)
      .where(eq(users.supabaseUserId, supabaseUserId))
      .get();

    if (!row) {
      throw new Error("Failed to create the dev bypass user.");
    }

    return {
      ...row,
      isAdmin: isAdminEmail(email),
      displayName: row.displayName ?? "Local Dev",
      avatarUrl: null,
    };
  } catch (err) {
    if (isSchemaMissingError(err)) {
      throw new Error(
        "Local database schema is missing (no users table). Run npm run db:migrate, then restart the dev server.",
        { cause: err },
      );
    }
    throw err;
  }
}
