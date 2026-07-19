import { redirect } from "next/navigation";
import { Bell, CreditCard } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { PageEnter } from "@/components/page-enter";
import { ProfileNameForm } from "@/components/profile-name-form";
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
    <AppShell
      user={{
        email: user.email,
        isAdmin: user.isAdmin,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      }}
      active="profile"
    >
      <PageEnter className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-3 py-5 sm:px-5 sm:py-6">
        <div className="border-b border-border/50 pb-4">
          <p className="font-mono text-[0.65rem] tracking-[0.2em] text-amber-400/90 uppercase">
            Account
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
            Profile &amp; settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in with Google via Supabase.
          </p>
        </div>

        <section className="flex flex-col gap-5 rounded-lg border border-border/70 bg-[oklch(0.175_0.016_255)] p-5">
          <div className="flex items-center gap-4">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                className="size-14 rounded-full border border-border object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex size-14 items-center justify-center rounded-full border border-border bg-secondary font-mono text-xl text-amber-300">
                {initial}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-medium">
                {user.displayName ?? user.email}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
            <span className="ml-auto rounded-sm border border-border/70 bg-muted/40 px-2 py-1 font-mono text-[0.6rem] tracking-[0.12em] text-muted-foreground uppercase">
              {user.isAdmin ? "Admin" : "Member"} · {user.subscription}
            </span>
          </div>

          <div className="border-t border-border/60 pt-5">
            <ProfileNameForm currentName={user.displayName} />
          </div>
        </section>

        <section className="rounded-lg border border-border/70 bg-[oklch(0.175_0.016_255)] p-5">
          <h2 className="text-sm font-semibold">Coming soon</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Preferences we&apos;re building next.
          </p>
          <ul className="mt-4 flex flex-col divide-y divide-border/50">
            <ComingSoonRow
              icon={<Bell className="size-4" />}
              title="Alert preferences"
              description="Email or push when a watched ticker files a material 8-K."
            />
            <ComingSoonRow
              icon={<CreditCard className="size-4" />}
              title="Billing & plan"
              description="Upgrade to Pro for real-time alerts and extended history."
            />
          </ul>
        </section>

        <section className="rounded-lg border border-border/70 bg-[oklch(0.175_0.016_255)] p-5">
          <h2 className="text-sm font-semibold">Session</h2>
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
    </AppShell>
  );
}

function ComingSoonRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span className="mt-0.5 text-muted-foreground/70">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground/85">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <span className="rounded-sm border border-border/60 px-1.5 py-0.5 font-mono text-[0.55rem] tracking-[0.1em] text-muted-foreground/70 uppercase">
        Soon
      </span>
    </li>
  );
}
