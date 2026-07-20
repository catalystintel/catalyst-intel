import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll is called from a Server Component - safe to ignore
            // because middleware refreshes the session on every request.
          }
        },
      },
    },
  );
}
