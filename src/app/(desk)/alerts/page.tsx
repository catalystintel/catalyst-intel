import { redirect } from "next/navigation";

import { AlertRulesPanel } from "@/components/alert-rules-panel";
import { PageEnter } from "@/components/page-enter";
import { getCurrentAppUser } from "@/lib/auth/current-user";

export default async function AlertsPage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/login?next=/alerts");
  }

  return (
    <PageEnter className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-5">
      <div className="border-b border-[var(--desk-border)] pb-5">
        <p className="font-mono text-[0.65rem] tracking-[0.2em] text-[var(--desk-live)] uppercase">
          Away desk
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--desk-text)] sm:text-2xl">
          Alert rules
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--desk-text-muted)]">
          Get AH/PM bombs when you are away from the tape. Pick Push, Telegram,
          webhook, or email — each channel has a short setup checklist. After
          you save a rule, use{" "}
          <span className="text-[var(--desk-text)]">Test</span> to fire against
          the latest catalyst and confirm delivery.
        </p>
      </div>
      <AlertRulesPanel />
    </PageEnter>
  );
}
