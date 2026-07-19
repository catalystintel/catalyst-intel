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
    <div className="flex flex-1 flex-col">
      <AppHeader
        email={user.email}
        isAdmin={user.isAdmin}
        displayName={user.displayName}
        avatarUrl={user.avatarUrl}
        active="admin"
      />
      <PageEnter className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-amber-400/90">
            Ops console
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Data ingestion</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Manually trigger vendor fetch jobs. Scheduled production runs still use the
            cron secret path (GitHub Actions).
          </p>
        </div>

        <section className="flex flex-col gap-4 rounded-xl border border-border/80 bg-card/40 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-medium">SEC EDGAR — 8-K filings</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Pull the latest Atom feed, dedupe by accession, resolve tickers.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs text-muted-foreground">
              <dt>Last row fetched</dt>
              <dd className="text-right text-foreground/90">
                {lastFetch?.fetchedAt
                  ? new Date(lastFetch.fetchedAt).toLocaleString()
                  : "Never"}
              </dd>
              <dt>Stored sources</dt>
              <dd className="text-right text-foreground/90">{sourceCount}</dd>
            </dl>
          </div>
          <FetchTrigger />
        </section>
      </PageEnter>
    </div>
  );
}
