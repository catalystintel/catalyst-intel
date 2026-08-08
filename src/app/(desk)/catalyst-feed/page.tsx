import { DeskDashboardGrid } from "@/components/desk-dashboard-grid";
import { PageEnter } from "@/components/page-enter";
import type { WatchlistCriteria } from "@/db/schema";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { toPublicFeedCatalyst } from "@/lib/catalysts/public-catalyst";
import {
  DEFAULT_FEED_FILTERS,
  type FeedFilterState,
} from "@/lib/catalysts/feed-filter-persist";
import {
  queryFeedPage,
  type FeedQueryFilters,
} from "@/lib/catalysts/feed-query";
import { resolveAdminShowSourceLabels } from "@/lib/catalysts/user-source-settings";
import { withDbRetry } from "@/lib/db/with-db-retry";
import { loadDeskMacroEvents } from "@/lib/jobs/desk-macro-events";
import { parseFeedCatalystId } from "@/lib/nav/feed-href";

function ssrFeedFilters(nowIso: string): FeedQueryFilters {
  // Same shared query as `/api/catalysts` — symbol gate always applied
  // (CPI / Jobs NFP excepted via `symbolFeedGateSql`).
  const defaults: FeedFilterState = DEFAULT_FEED_FILTERS;
  return {
    q: defaults.symbolQuery,
    symbols: defaults.symbolFilters,
    categories: defaults.categoryFilters,
    sectors: defaults.sectorFilters,
    forms: defaults.formFilters,
    sources: defaults.sourceFilters,
    tags: defaults.tagFilters,
    timeWindow: defaults.timeWindow,
    symbolOnly: true,
    earningsSurprisesOnly: defaults.earningsSurprisesOnly,
    criteriaGroups: [],
    since: null,
    until: nowIso,
  };
}

export default async function CatalystFeedPage({
  searchParams,
}: {
  searchParams: Promise<{
    symbol?: string;
    c?: string;
    symbols?: string;
    categories?: string;
    sources?: string;
    tags?: string;
    q?: string;
  }>;
}) {
  const { symbol, c, symbols, categories, sources, tags, q } =
    await searchParams;
  const initialSelectedId = parseFeedCatalystId(c);
  // "Apply to feed" deep link from a saved watchlist (see `/watchlist`).
  const initialWatchlistCriteria: WatchlistCriteria | undefined =
    symbols || categories || sources || tags || q
      ? {
          symbols: symbols
            ?.split(",")
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean),
          categories: categories
            ?.split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          sources: sources
            ?.split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
          tags: tags
            ?.split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
          q: q?.trim(),
        }
      : undefined;

  // Auth / DB setup handled by the shared `(desk)/layout.tsx`.
  const user = await getCurrentAppUser();
  if (!user) {
    return null;
  }

  const showSourceLabels = await resolveAdminShowSourceLabels(
    user.id,
    user.isAdmin,
  );
  const recentCatalysts = await withDbRetry(() =>
    queryFeedPage(ssrFeedFilters(new Date().toISOString()), {
      limit: 200,
    }),
  );
  // Prefer FMP-ingested core prints when dedicated cron has run; else
  // keyless embedded BLS/Fed schedule (same as macro-calendar ingest).
  const macroEvents = await loadDeskMacroEvents();

  return (
    <PageEnter className="flex min-h-0 flex-1 flex-col p-3 sm:p-4 2xl:p-5">
      <DeskDashboardGrid
        initialCatalysts={recentCatalysts.map(toPublicFeedCatalyst)}
        isAdmin={user.isAdmin}
        showSourceLabels={showSourceLabels}
        initialSymbolFilter={symbol?.trim().toUpperCase() || undefined}
        initialWatchlistCriteria={initialWatchlistCriteria}
        initialSelectedId={initialSelectedId}
        macroEvents={macroEvents}
      />
    </PageEnter>
  );
}
