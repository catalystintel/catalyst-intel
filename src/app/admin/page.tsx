import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { isLibsqlConfigured } from "@/db/env";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

import { FetchTrigger } from "./fetch-trigger";

export default async function AdminPage() {
  if (!isLibsqlConfigured()) {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        redirect("/login?next=/admin");
      }
    }
    return <DatabaseSetupNotice />;
  }

  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader email={user.email} role={user.role} />
      <main className="flex flex-1 flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Data ingestion</h1>
          <p className="text-sm text-muted-foreground">
            Manually trigger vendor fetch jobs. This will later move to a scheduled worker.
          </p>
        </div>
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">SEC EDGAR — 8-K filings</h2>
          <FetchTrigger />
        </section>
      </main>
    </div>
  );
}
