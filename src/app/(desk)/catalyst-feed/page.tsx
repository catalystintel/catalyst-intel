import { LiveCatalystFeed } from "@/components/live-catalyst-feed";
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
import { withDbRetry } from "@/lib/db/with-db-retry";
import { parseFeedCatalystId } from "@/lib/nav/feed-href";

function ssrFeedFilters(nowIso: string): FeedQueryFilters {
  // Same shared query as `/api/catalysts` — ticker gate always applied
  // (CPI / Jobs NFP excepted via `tickerFeedGateSql`).
  const defaults: FeedFilterState = DEFAULT_FEED_FILTERS;
  return {
    q: defaults.tickerQuery,
    categories: defaults.categoryFilters,
    sectors: defaults.sectorFilters,
    forms: defaults.formFilters,
    sources: defaults.sourceFilters,
    timeWindow: defaults.timeWindow,
    tickerOnly: true,
    since: null,
    until: nowIso,
  };
}

export default async function CatalystFeedPage({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string; c?: string }>;
}) {
  const { ticker, c } = await searchParams;
  const initialSelectedId = parseFeedCatalystId(c);

  // Auth / DB setup handled by the shared `(desk)/layout.tsx`.
  const user = await getCurrentAppUser();
  if (!user) {
    return null;
  }

  const recentCatalysts = await withDbRetry(() =>
    queryFeedPage(ssrFeedFilters(new Date().toISOString()), { limit: 200 }),
  );

  return (
    <PageEnter className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
      <LiveCatalystFeed
        initialCatalysts={recentCatalysts.map(toFeedCatalyst)}
        isAdmin={user.isAdmin}
        initialTickerFilter={ticker?.trim().toUpperCase() || undefined}
        initialSelectedId={initialSelectedId}
      />
    </PageEnter>
  );
}
