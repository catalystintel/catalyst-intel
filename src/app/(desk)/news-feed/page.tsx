import { redirect } from "next/navigation";

import { NewsFeed } from "@/components/news-feed";
import { PageEnter } from "@/components/page-enter";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import {
  NEWS_FEED_PAGE_SIZE,
  parseNewsFeedFilters,
  queryNewsFeedPage,
  queryNewsFeedTotal,
} from "@/lib/catalysts/news-feed-query";
import { withDbRetry } from "@/lib/db/with-db-retry";

export default async function NewsFeedPage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/login?next=/news-feed");
  }

  const params = new URLSearchParams({ window: "24h" });
  const filters = parseNewsFeedFilters(params);

  const [initialHeadlines, initialTotal] = await withDbRetry(() =>
    Promise.all([
      queryNewsFeedPage(filters, { limit: NEWS_FEED_PAGE_SIZE }),
      queryNewsFeedTotal(filters),
    ]),
  );

  return (
    <PageEnter className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
      <NewsFeed
        initialHeadlines={initialHeadlines}
        initialTotal={initialTotal}
      />
    </PageEnter>
  );
}
