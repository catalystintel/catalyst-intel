import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";

import { AppShell } from "@/components/app-shell";
import { LiveCatalystFeed } from "@/components/live-catalyst-feed";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { PageEnter } from "@/components/page-enter";
import { db } from "@/db/client";
import { isLibsqlConfigured } from "@/db/env";
import { catalysts, rawSources } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { toFeedCatalyst } from "@/lib/catalysts/feed-catalyst";
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
      companyName: catalysts.companyName,
      type: catalysts.type,
      title: catalysts.title,
      headline: catalysts.headline,
      eventCategory: catalysts.eventCategory,
      itemCodes: catalysts.itemCodes,
      timestamp: catalysts.timestamp,
      summary: catalysts.summary,
      impactScore: catalysts.impactScore,
      sourceUrl: rawSources.url,
    })
    .from(catalysts)
    .leftJoin(rawSources, eq(catalysts.rawSourceId, rawSources.id))
    .orderBy(desc(catalysts.timestamp))
    .limit(50)
    .all();

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
      <PageEnter className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-3 py-5 sm:px-5 sm:py-6">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/50 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="live-pulse inline-block size-1.5 rounded-full bg-amber-400"
              />
              <p className="font-mono text-[0.65rem] tracking-[0.2em] text-amber-400/90 uppercase">
                Live feed
              </p>
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
              On-spot catalysts
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              8-K filings decoded as they hit — each row shows the ticker,
              company, and the actual event (earnings, M&amp;A, management,
              distress…). Click for items and the filing link. Soft-refreshes
              while focused; pauses when hidden.
            </p>
          </div>
          <p className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
            Desk · multi-monitor scan
          </p>
        </div>

        <LiveCatalystFeed
          initialCatalysts={recentCatalysts.map(toFeedCatalyst)}
          isAdmin={user.isAdmin}
        />
      </PageEnter>
    </AppShell>
  );
}
