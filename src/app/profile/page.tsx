import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { PageEnter } from "@/components/page-enter";
import { Button } from "@/components/ui/button";
import { isLibsqlConfigured } from "@/db/env";
import { logout, signOutEverywhere } from "@/app/login/actions";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function ProfilePage() {
  if (!isLibsqlConfigured()) {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        redirect("/login?next=/profile");
      }
    }
    return <DatabaseSetupNotice />;
  }

  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login?next=/profile");
  }

  const initial = (
    user.displayName?.trim()?.[0] ||
    user.email[0] ||
    "?"
  ).toUpperCase();

  return (
    <div className="desk-shell flex flex-1 flex-col">
      <AppHeader
        email={user.email}
        isAdmin={user.isAdmin}
        displayName={user.displayName}
        avatarUrl={user.avatarUrl}
        active="profile"
      />
      <PageEnter className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-3 py-5 sm:px-5 sm:py-6">
        <div className="border-b border-border/50 pb-4">
          <p className="font-mono text-[0.65rem] tracking-[0.2em] text-amber-400/90 uppercase">
            Account
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            Profile
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Google via Supabase. Disconnect clears this session only.
          </p>
        </div>

        <section className="flex flex-col gap-5 border border-border/70 bg-[oklch(0.175_0.016_255)] p-5 sm:flex-row sm:items-center">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="size-14 rounded-sm border border-border object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-sm border border-border bg-secondary font-mono text-xl text-amber-300">
              {initial}
            </span>
          )}
          <dl className="grid flex-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
                Name
              </dt>
              <dd className="mt-1">{user.displayName ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
                Email
              </dt>
              <dd className="mt-1 font-mono text-xs break-all sm:text-sm">
                {user.email}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
                Plan
              </dt>
              <dd className="mt-1 capitalize">{user.subscription}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
                Access
              </dt>
              <dd className="mt-1 font-mono text-xs sm:text-sm">
                {user.isAdmin ? "Admin · allowlist" : "Member"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="border border-border/70 bg-[oklch(0.175_0.016_255)] p-5">
          <h2 className="font-mono text-sm tracking-wide">Disconnect</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Sign out ends your Catalyst Intel session. It does not delete your
            Google account or permanently unlink OAuth from Supabase.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <form action={logout}>
              <Button type="submit" variant="outline" className="btn-press">
                Sign out
              </Button>
            </form>
            <form action={signOutEverywhere}>
              <Button type="submit" variant="destructive" className="btn-press">
                Sign out everywhere
              </Button>
            </form>
          </div>
        </section>
      </PageEnter>
    </div>
  );
}
