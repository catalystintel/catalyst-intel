import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";

import { AppHeader } from "@/components/app-header";
import { LiveCatalystFeed } from "@/components/live-catalyst-feed";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { PageEnter } from "@/components/page-enter";
import { db } from "@/db/client";
import { isLibsqlConfigured } from "@/db/env";
import { catalysts } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function DashboardPage() {
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

  const recentCatalysts = await db
    .select({
      id: catalysts.id,
      ticker: catalysts.ticker,
      type: catalysts.type,
      title: catalysts.title,
      timestamp: catalysts.timestamp,
    })
    .from(catalysts)
    .orderBy(desc(catalysts.timestamp))
    .limit(50)
    .all();

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        email={user.email}
        isAdmin={user.isAdmin}
        displayName={user.displayName}
        avatarUrl={user.avatarUrl}
        active="live"
      />
      <PageEnter className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-amber-400/90">
            Live feed
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Market catalysts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Newest filings first — soft-refreshes while this tab is focused; pauses when
            hidden.
          </p>
        </div>

        <LiveCatalystFeed
          initialCatalysts={recentCatalysts}
          isAdmin={user.isAdmin}
        />
      </PageEnter>
    </div>
  );
}
