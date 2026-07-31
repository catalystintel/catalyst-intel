import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16 renamed the "middleware" convention to "proxy" - this refreshes
// the Supabase session cookie and does a cheap, optimistic redirect for
// unauthenticated visitors. On Vercel Preview it also requires an admin
// email. The real authorization check lives in `getCurrentAppUser()` /
// email allowlist checks on /catalyst-feed, /admin, /profile, desk layout,
// and admin APIs (proxy is not treated as the security boundary).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
