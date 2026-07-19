import { redirect } from "next/navigation";
import { count, desc, eq } from "drizzle-orm";

import { AppHeader } from "@/components/app-header";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { PageEnter } from "@/components/page-enter";
import { db } from "@/db/client";
import { isLibsqlConfigured } from "@/db/env";
import { rawSources } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

import { FetchTrigger } from "./fetch-trigger";

export default async function AdminPage() {
  if (!isLibsqlConfigured()) {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        redirect("/login?next=/admin");
      }
    }
    return <DatabaseSetupNotice />;
  }

  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  if (!user.isAdmin) {
    redirect("/dashboard");
  }

  const lastFetch = await db
    .select({
      fetchedAt: rawSources.fetchedAt,
    })
    .from(rawSources)
    .where(eq(rawSources.provider, "sec-edgar"))
    .orderBy(desc(rawSources.fetchedAt))
    .limit(1)
    .get();

  const sourceCountRow = await db
    .select({ value: count() })
    .from(rawSources)
    .where(eq(rawSources.provider, "sec-edgar"))
    .get();
  const sourceCount = sourceCountRow?.value ?? 0;

  return (
    <div className="desk-shell flex flex-1 flex-col">
      <AppHeader
        email={user.email}
        isAdmin={user.isAdmin}
        displayName={user.displayName}
        avatarUrl={user.avatarUrl}
        active="admin"
      />
      <PageEnter className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-3 py-5 sm:px-5 sm:py-6">
        <div className="border-b border-border/50 pb-4">
          <p className="font-mono text-[0.65rem] tracking-[0.2em] text-amber-400/90 uppercase">
            Ops console
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            Data ingestion
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Trigger vendor fetch jobs for the Live tape. Production schedules
            still use the cron secret path (GitHub Actions).
          </p>
        </div>

        <section className="border border-border/70 bg-[oklch(0.175_0.016_255)]">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-mono text-sm tracking-wide text-foreground">
                SEC EDGAR · 8-K
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pull the Atom feed, dedupe by accession, resolve tickers into
                the Live feed.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-1 font-mono text-xs">
              <dt className="text-muted-foreground">Last fetch</dt>
              <dd className="text-right text-foreground/90 tabular-nums">
                {lastFetch?.fetchedAt
                  ? new Date(lastFetch.fetchedAt).toLocaleString()
                  : "Never"}
              </dd>
              <dt className="text-muted-foreground">Stored sources</dt>
              <dd className="text-right text-foreground/90 tabular-nums">
                {sourceCount}
              </dd>
            </dl>
          </div>
          <div className="px-4 py-4 sm:px-5">
            <FetchTrigger />
          </div>
        </section>
      </PageEnter>
    </div>
  );
}
