import { redirect } from "next/navigation";

import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { AppShell } from "@/components/app-shell";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { PageEnter } from "@/components/page-enter";
import { isLibsqlConfigured } from "@/db/env";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function AnalyticsPage() {
  if (!isLibsqlConfigured()) {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        redirect("/login?next=/analytics");
      }
    }
    return <DatabaseSetupNotice />;
  }

  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login?next=/analytics");
  }

  return (
    <AppShell
      user={{
        email: user.email,
        isAdmin: user.isAdmin,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      }}
      active="analytics"
    >
      <PageEnter className="flex min-h-0 flex-1 flex-col">
        <AnalyticsDashboard />
      </PageEnter>
    </AppShell>
  );
}
