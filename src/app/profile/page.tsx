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

  const initial = (user.displayName?.trim()?.[0] || user.email[0] || "?").toUpperCase();

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader
        email={user.email}
        isAdmin={user.isAdmin}
        displayName={user.displayName}
        avatarUrl={user.avatarUrl}
        active="profile"
      />
      <PageEnter className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-amber-400/90">
            Account
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in with Google via Supabase. Disconnect clears your session here.
          </p>
        </div>

        <section className="flex flex-col gap-6 rounded-xl border border-border/80 bg-card/40 p-6 sm:flex-row sm:items-center">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="size-16 rounded-full border border-border object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex size-16 items-center justify-center rounded-full border border-border bg-secondary font-mono text-xl text-amber-300">
              {initial}
            </span>
          )}
          <dl className="grid flex-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
                Name
              </dt>
              <dd className="mt-1">{user.displayName ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
                Email
              </dt>
              <dd className="mt-1 break-all">{user.email}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
                Plan
              </dt>
              <dd className="mt-1 capitalize">{user.subscription}</dd>
            </div>
            <div>
              <dt className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
                Access
              </dt>
              <dd className="mt-1">{user.isAdmin ? "Admin (allowlist)" : "Member"}</dd>
            </div>
          </dl>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/40 p-6">
          <h2 className="text-sm font-medium">Disconnect</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Sign out ends your Catalyst Intel session. It does not delete your Google
            account or permanently unlink the OAuth identity from Supabase.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
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
