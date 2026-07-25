import { redirect } from "next/navigation";

import { ReportsDesk } from "@/components/reports-desk";
import { PageEnter } from "@/components/page-enter";
import { getCurrentAppUser } from "@/lib/auth/current-user";

export default async function ReportsPage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/login?next=/reports");
  }

  return (
    <PageEnter className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
      <ReportsDesk />
    </PageEnter>
  );
}
