import { DeskDashboardGrid } from "@/components/desk-dashboard-grid";
import { PageEnter } from "@/components/page-enter";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { toFeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import {
  DEFAULT_FEED_FILTERS,
  type FeedFilterState,
} from "@/lib/catalysts/feed-filter-persist";
import {
  queryFeedPage,
  type FeedQueryFilters,
} from "@/lib/catalysts/feed-query";
import {
  mergeSourceProviderFilters,
  resolveAdminFeedProviders,
  resolveAdminShowSourceLabels,
} from "@/lib/catalysts/user-source-settings";
import { withDbRetry } from "@/lib/db/with-db-retry";
import { loadDeskMacroEvents } from "@/lib/jobs/desk-macro-events";
import { parseFeedCatalystId } from "@/lib/nav/feed-href";

function ssrFeedFilters(
  nowIso: string,
  adminProviders: string[] | null,
): FeedQueryFilters {
  // Same shared query as `/api/catalysts` — symbol gate always applied
  // (CPI / Jobs NFP excepted via `symbolFeedGateSql`).
  const defaults: FeedFilterState = DEFAULT_FEED_FILTERS;
  return {
    q: defaults.symbolQuery,
    categories: defaults.categoryFilters,
    sectors: defaults.sectorFilters,
    forms: defaults.formFilters,
    sources: mergeSourceProviderFilters(defaults.sourceFilters, adminProviders),
    timeWindow: defaults.timeWindow,
    symbolOnly: true,
    earningsSurprisesOnly: defaults.earningsSurprisesOnly,
    since: null,
    until: nowIso,
  };
}

export default async function CatalystFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; c?: string }>;
}) {
  const { symbol, c } = await searchParams;
  const initialSelectedId = parseFeedCatalystId(c);

  // Auth / DB setup handled by the shared `(desk)/layout.tsx`.
  const user = await getCurrentAppUser();
  if (!user) {
    return null;
  }

  const [adminProviders, showSourceLabels] = await Promise.all([
    resolveAdminFeedProviders(user.id, user.isAdmin),
    resolveAdminShowSourceLabels(user.id, user.isAdmin),
  ]);
  const recentCatalysts = await withDbRetry(() =>
    queryFeedPage(ssrFeedFilters(new Date().toISOString(), adminProviders), {
      limit: 200,
    }),
  );
  // Prefer FMP-ingested core prints when dedicated cron has run; else
  // keyless embedded BLS/Fed schedule (same as macro-calendar ingest).
  const macroEvents = await loadDeskMacroEvents();

  return (
    <PageEnter className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
      <DeskDashboardGrid
        initialCatalysts={recentCatalysts.map(toFeedCatalyst)}
        isAdmin={user.isAdmin}
        showSourceLabels={showSourceLabels}
        initialSymbolFilter={symbol?.trim().toUpperCase() || undefined}
        initialSelectedId={initialSelectedId}
        macroEvents={macroEvents}
      />
    </PageEnter>
  );
}
