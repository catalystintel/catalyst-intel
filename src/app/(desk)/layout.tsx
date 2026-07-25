import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { isLibsqlConfigured, isSchemaMissingError } from "@/db/env";
import { isLocalSqliteReady } from "@/db/local-sqlite-ready";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Shared chrome for all authenticated desk routes
 * (`/dashboard`, `/analytics`, `/admin`, `/alerts`, `/watchlist`, `/profile`).
 *
 * Keeps the real sidebar/header mounted across navigations so route
 * `loading.tsx` files only skeleton the content pane — never the chrome.
 */
export default async function DeskLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!isLibsqlConfigured() || !isLocalSqliteReady()) {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        redirect("/login");
      }
    }
    return <DatabaseSetupNotice />;
  }

  let user;
  try {
    user = await getCurrentAppUser();
  } catch (err) {
    // Empty/partial local.db used to throw through the whole desk (and Next
    // then surfaces ThemeProvider / Performance.measure noise on top).
    if (isSchemaMissingError(err)) {
      return <DatabaseSetupNotice />;
    }
    throw err;
  }

  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell
      user={{
        email: user.email,
        isAdmin: user.isAdmin,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      }}
    >
      {children}
    </AppShell>
  );
}
