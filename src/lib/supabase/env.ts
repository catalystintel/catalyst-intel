/**
 * Returns true when Supabase public env vars look like real project credentials
 * (not the placeholder values we ship for CI / first-run smoke tests).
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url || !anonKey) return false;
  if (url.includes("placeholder")) return false;
  if (anonKey.includes("placeholder")) return false;

  return url.startsWith("https://") && anonKey.length > 20;
}

export const SUPABASE_SETUP_HINT =
  "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, enable the Google provider in Supabase, then restart `npm run dev`. See README.md.";
