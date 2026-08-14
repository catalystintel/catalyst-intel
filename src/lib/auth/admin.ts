/**
 * Admin panel access is gated by verified Supabase session email
 * (Google OAuth JWT), not by a client-side flag or a manually promoted DB role.
 *
 * Agreed operators in `DEFAULT_ADMIN_EMAILS` are always allowlisted. Optional
 * `ADMIN_EMAILS` (comma-separated) adds more addresses on top — it cannot
 * remove the built-in operators, so a missing/mis-set Vercel env cannot lock
 * them out of `/admin`.
 */
const DEFAULT_ADMIN_EMAILS = [
  "omer.nachshon@gmail.com",
  "zhbar10@gmail.com",
  "catalyst.intel.feedback@gmail.com",
] as const;

function parseAdminEmails(raw: string): string[] {
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getAdminEmails(): string[] {
  const defaults = DEFAULT_ADMIN_EMAILS.map((email) => email.toLowerCase());
  const fromEnv = process.env.ADMIN_EMAILS?.trim();
  if (!fromEnv) {
    return defaults;
  }
  return Array.from(new Set([...defaults, ...parseAdminEmails(fromEnv)]));
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export function adminRoleForEmail(
  email: string | null | undefined,
): "admin" | "user" {
  return isAdminEmail(email) ? "admin" : "user";
}
