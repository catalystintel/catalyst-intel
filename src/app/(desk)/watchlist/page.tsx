import { redirect } from "next/navigation";

import { PageEnter } from "@/components/page-enter";
import { WatchlistHub } from "@/components/watchlists/watchlist-hub";
import { getCurrentAppUser } from "@/lib/auth/current-user";

export default async function WatchlistPage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/login?next=/watchlist");
  }

  return (
    <PageEnter className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 p-4 sm:p-5">
      <div className="border-b border-[var(--desk-border)] pb-4">
        <p className="font-mono text-[0.65rem] tracking-[0.2em] text-[var(--desk-live)] uppercase">
          Your rules
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--desk-text)] sm:text-2xl">
          Watchlists
        </h1>
        <p className="mt-1 max-w-xl text-sm text-[var(--desk-text-muted)]">
          Save the symbols and conditions you care about, apply them to the Live
          tape in one click, and use them to quiet the noise when you need to.
        </p>
      </div>
      <WatchlistHub />
    </PageEnter>
  );
}
