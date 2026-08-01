import { redirect } from "next/navigation";
import { count, desc, sql } from "drizzle-orm";

import { PageEnter } from "@/components/page-enter";
import { db } from "@/db/client";
import { nyseListings, rawSources } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { withDbRetry } from "@/lib/db/with-db-retry";
import { isFinnhubConfigured } from "@/lib/jobs/finnhub-env";

import { isDbResetAllowed } from "@/lib/ops/non-production-env";

import { FetchTrigger } from "./fetch-trigger";
import { IngestionAuditSection } from "./ingestion-audit-section";
import { MigrateTrigger } from "./migrate-trigger";
import { ResetDbTrigger } from "./reset-db-trigger";
import { SourceVisibilityToggles } from "./source-visibility-toggles";
import { TelegramBotSetup } from "./telegram-bot-setup";
import { WhatsNewPanel } from "./whats-new-panel";

export default async function AdminPage() {
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  if (!user.isAdmin) {
    redirect("/catalyst-feed");
  }

  // Independent reads - run them concurrently instead of one round-trip at a
  // time. Each await here is a network hop to Turso, and sequencing them was
  // a meaningful chunk of this page's load latency.
  const [lastFetch, sourceCountRow, providerCounts, nyseCountRow] =
    await withDbRetry(() =>
      Promise.all([
        db
          .select({ fetchedAt: rawSources.fetchedAt })
          .from(rawSources)
          .orderBy(desc(rawSources.fetchedAt))
          .limit(1)
          .get(),
        db.select({ value: count() }).from(rawSources).get(),
        db
          .select({
            provider: rawSources.provider,
            value: count(),
          })
          .from(rawSources)
          .groupBy(rawSources.provider)
          .orderBy(sql`count(*) desc`)
          .all(),
        db.select({ value: count() }).from(nyseListings).get(),
      ]),
    );
  const sourceCount = sourceCountRow?.value ?? 0;
  const nyseCount = nyseCountRow?.value ?? 0;
  const finnhubConfigured = isFinnhubConfigured();
  const showResetDb = isDbResetAllowed();

  return (
    <PageEnter className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-5">
      <div className="border-b border-[var(--desk-border)] pb-4">
        <p className="font-mono text-[0.65rem] tracking-[0.2em] text-[var(--desk-live)] uppercase">
          Ops console
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--desk-text)] sm:text-2xl">
          Data ingestion
        </h1>
        <p className="mt-1 max-w-xl text-sm text-[var(--desk-text-muted)]">
          Trigger vendor fetch jobs for the Catalyst Feed. Production schedules
          use the cron secret path (cron-job.org, every 1 min). Scroll to
          What&apos;s new for release notes and a platform swim sheet.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
        <div className="border-b border-border/60 px-4 py-4 sm:px-5">
          <WhatsNewPanel />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
        <div className="border-b border-border/60 px-4 py-4 sm:px-5">
          <h2 className="font-mono text-sm tracking-wide text-foreground">
            My feed sources
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Personal visibility only — toggles which vendors appear in{" "}
            <span className="text-[var(--desk-text-secondary)]">your</span>{" "}
            Catalyst Feed. Does not pause ingest or change other admins&apos;
            views.
          </p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <SourceVisibilityToggles />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-mono text-sm tracking-wide text-foreground">
              Multi-source ingest
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Phased fetch (A keyless → B PR wire + Finnhub → C Polygon news
              then prices). Results listed Must→Should. Soft-skips when optional
              keys are missing. See FETCH-ORDER.md.
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
        {providerCounts.length > 0 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border/60 px-4 py-3 font-mono text-xs text-[var(--desk-text-muted)] sm:px-5">
            {providerCounts.map((row) => (
              <li key={row.provider}>
                <span className="text-[var(--desk-text-secondary)]">
                  {row.provider}
                </span>
                {" · "}
                <span className="text-foreground/90 tabular-nums">
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="px-4 py-4 sm:px-5">
          <FetchTrigger />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-mono text-sm tracking-wide text-foreground">
              Database migrations
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Migrations already run automatically on every deploy (`npm run
              build`, and via the CI/CD migrate workflow — see DEPLOYMENT.md).
              Use this to apply pending migrations to this environment right now
              without waiting on a deploy.
            </p>
          </div>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <MigrateTrigger />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
        <div className="border-b border-border/60 px-4 py-4 sm:px-5">
          <h2 className="font-mono text-sm tracking-wide text-foreground">
            Telegram bot
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One-click webhook + commands + brand avatar so /start returns chat
            IDs for alert rules.
          </p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <TelegramBotSetup />
        </div>
      </section>

      {showResetDb ? (
        <section className="overflow-hidden rounded-xl border border-[var(--desk-negative)]/40 bg-[var(--desk-panel)]">
          <div className="border-b border-border/60 px-4 py-4 sm:px-5">
            <h2 className="font-mono text-sm tracking-wide text-foreground">
              Clear database (ALLOW_DB_RESET)
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Hidden when{" "}
              <code className="font-mono">VERCEL_ENV=production</code>. Use
              locally or on preview to wipe the tape and re-ingest.
            </p>
          </div>
          <div className="px-4 py-4 sm:px-5">
            <ResetDbTrigger />
          </div>
        </section>
      ) : null}

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
            <dt className="text-muted-foreground">Credential</dt>
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
            Finnhub is not configured in this environment. Add Finnhub
            credentials in the hosting environment, then run Fetch NYSE
            listings. Watchlist stays usable without it (empty price
            enrichment).
          </p>
        ) : null}
      </section>

      <IngestionAuditSection />
    </PageEnter>
  );
}
