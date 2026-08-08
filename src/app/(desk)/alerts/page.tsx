import { redirect } from "next/navigation";

import { AlertRulesPanel } from "@/components/alert-rules-panel";
import { getCurrentAppUser } from "@/lib/auth/current-user";

/**
 * No `PageEnter` here — that animation starts at opacity 0 and flashed a blank
 * pane between the route loading skeleton and the panel fetch skeleton.
 * Keep the Away desk chrome static so `/alerts` stays visually continuous.
 */
export default async function AlertsPage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/login?next=/alerts");
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-5">
      <div className="border-b border-[var(--desk-border)] pb-5">
        <p className="font-mono text-[0.65rem] tracking-[0.2em] text-[var(--desk-live)] uppercase">
          Away desk
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--desk-text)] sm:text-2xl">
          Notifications
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--desk-text-muted)]">
          Pick how you want to be reached, attach the watchlists that matter,
          and we&apos;ll fire when matching catalysts hit. Create new lists from
          Watchlists anytime.
        </p>
      </div>
      <AlertRulesPanel />
    </div>
  );
}
