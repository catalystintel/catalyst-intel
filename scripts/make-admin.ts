/**
 * Deprecated: admin access is now decided from the verified Supabase session
 * email against `ADMIN_EMAILS` (or built-in defaults). See `src/lib/auth/admin.ts`.
 *
 * This script still syncs the local `users.role` column for an email so DB
 * caches stay consistent — it does **not** grant admin panel access by itself.
 *
 * Usage: npm run make-admin -- you@email.com
 */
async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // optional if already in the environment
  }

  const email = process.argv[2];

  if (!email) {
    console.error("Usage: npm run make-admin -- you@email.com");
    console.error(
      "Note: Admin panel access uses ADMIN_EMAILS / defaults, not this script alone.",
    );
    process.exit(1);
  }

  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/db/client");
  const { users } = await import("@/db/schema");
  const { adminRoleForEmail, getAdminEmails } =
    await import("@/lib/auth/admin");

  const role = adminRoleForEmail(email);
  const allowlist = getAdminEmails();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (!existing) {
    console.error(
      `No local user found for "${email}". Log in through the app once first (this creates the local user row), then re-run if you only need the DB role cache updated.`,
    );
    console.error(`Allowlist currently: ${allowlist.join(", ")}`);
    process.exit(1);
  }

  await db.update(users).set({ role }).where(eq(users.email, email)).run();

  if (role === "admin") {
    console.log(
      `"${email}" is on the admin allowlist — synced local role to admin.`,
    );
  } else {
    console.log(
      `"${email}" is NOT on the admin allowlist — synced local role to user.`,
    );
    console.log(
      `To grant admin access, add the email to ADMIN_EMAILS (comma-separated) or the defaults in src/lib/auth/admin.ts.`,
    );
    console.log(`Current allowlist: ${allowlist.join(", ")}`);
  }
}

main();
