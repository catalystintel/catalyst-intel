import { redirect } from "next/navigation";

import { AlertRulesPanel } from "@/components/alert-rules-panel";
import { AppShell } from "@/components/app-shell";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { PageEnter } from "@/components/page-enter";
import { isLibsqlConfigured } from "@/db/env";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function AlertsPage() {
  if (!isLibsqlConfigured()) {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        redirect("/login?next=/alerts");
      }
    }
    return <DatabaseSetupNotice />;
  }

  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/login?next=/alerts");
  }

  return (
    <AppShell
      user={{
        email: user.email,
        isAdmin: user.isAdmin,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      }}
      active="alerts"
    >
      <PageEnter className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-5">
        <div className="border-b border-[var(--desk-border)] pb-4">
          <p className="font-mono text-[0.65rem] tracking-[0.2em] text-[var(--desk-live)] uppercase">
            Away desk
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--desk-text)] sm:text-2xl">
            Alert rules
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--desk-text-muted)]">
            Webhook and email rules for AH/PM bombs. Use Test to fire against
            the latest catalyst. Push is stubbed until FCM lands.
          </p>
        </div>
        <AlertRulesPanel />
      </PageEnter>
    </AppShell>
  );
}
