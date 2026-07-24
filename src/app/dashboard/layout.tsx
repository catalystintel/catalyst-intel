import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { isLibsqlConfigured } from "@/db/env";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Shared chrome for `/dashboard` and `/dashboard/catalyst/[id]`.
 * Keeps the real sidebar/header mounted across Live tape ↔ article navigations
 * so `loading.tsx` only skeletons the content pane (not the whole desk).
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!isLibsqlConfigured()) {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        redirect("/login?next=/dashboard");
      }
    }
    return <DatabaseSetupNotice />;
  }

  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/login?next=/dashboard");
  }

  return (
    <AppShell
      user={{
        email: user.email,
        isAdmin: user.isAdmin,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      }}
      active="live"
    >
      {children}
    </AppShell>
  );
}
