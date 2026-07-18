import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/db/schema";

/**
 * One-off CLI helper to promote a user to admin, since there's no
 * self-serve promotion flow yet.
 *
 * Usage: npm run make-admin -- you@email.com
 */
async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Usage: npm run make-admin -- you@email.com");
    process.exit(1);
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).get();

  if (!existing) {
    console.error(
      `No local user found for "${email}". Log in through the app once first (this creates the local user row), then re-run this script.`,
    );
    process.exit(1);
  }

  await db.update(users).set({ role: "admin" }).where(eq(users.email, email)).run();

  console.log(`"${email}" is now an admin.`);
}

main();
