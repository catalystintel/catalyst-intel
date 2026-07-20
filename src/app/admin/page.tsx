import { redirect } from "next/navigation";
import { count, desc, eq } from "drizzle-orm";

import { AppShell } from "@/components/app-shell";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { PageEnter } from "@/components/page-enter";
import { db } from "@/db/client";
import { isLibsqlConfigured } from "@/db/env";
import { nyseListings, rawSources } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { isFinnhubConfigured } from "@/lib/jobs/finnhub-env";
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

  const nyseCountRow = await db
    .select({ value: count() })
    .from(nyseListings)
    .get();
  const nyseCount = nyseCountRow?.value ?? 0;
  const finnhubConfigured = isFinnhubConfigured();

  return (
    <AppShell
      user={{
        email: user.email,
        isAdmin: user.isAdmin,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      }}
      active="admin"
    >
      <PageEnter className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-5">
        <div className="border-b border-[var(--desk-border)] pb-4">
          <p className="font-mono text-[0.65rem] tracking-[0.2em] text-[var(--desk-live)] uppercase">
            Ops console
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--desk-text)] sm:text-2xl">
            Data ingestion
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--desk-text-muted)]">
            Trigger vendor fetch jobs for the Live tape. Production schedules
            still use the cron secret path (GitHub Actions).
          </p>
        </div>

        <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-mono text-sm tracking-wide text-foreground">
                Multi-source ingest
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Orchestrated fetch across SEC, Nasdaq halts, Finnhub, Polygon,
                openFDA, and ClinicalTrials. Soft-skips when optional keys are
                missing.
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

        <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-mono text-sm tracking-wide text-foreground">
                Finnhub · NYSE
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Listing universe status. Use the fetch control above to refresh.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-1 font-mono text-xs">
              <dt className="text-muted-foreground">API key</dt>
              <dd className="text-right text-foreground/90">
                {finnhubConfigured ? "Set" : "Missing"}
              </dd>
              <dt className="text-muted-foreground">NYSE rows</dt>
              <dd className="text-right text-foreground/90 tabular-nums">
                {nyseCount}
              </dd>
            </dl>
          </div>
          {!finnhubConfigured ? (
            <p className="px-4 py-4 text-sm text-[var(--desk-text-muted)] sm:px-5">
              Set{" "}
              <code className="font-mono text-[0.85em] text-[var(--desk-text-secondary)]">
                FINNHUB_API_KEY
              </code>{" "}
              in Vercel / .env.local, then run Fetch NYSE listings. Watchlist
              stays usable without it (empty price enrichment).
            </p>
          ) : null}
        </section>
      </PageEnter>
    </AppShell>
  );
}
