import { redirect } from "next/navigation";

import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { PageEnter } from "@/components/page-enter";
import { getCurrentAppUser } from "@/lib/auth/current-user";

export default async function AnalyticsPage() {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/login?next=/analytics");
  }

  return (
    <PageEnter className="flex min-h-0 flex-1 flex-col">
      <AnalyticsDashboard />
    </PageEnter>
  );
}
