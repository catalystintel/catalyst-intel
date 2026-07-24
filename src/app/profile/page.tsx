import { redirect } from "next/navigation";
import { Bell, CreditCard } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { PageEnter } from "@/components/page-enter";
import { ProfileNameForm } from "@/components/profile-name-form";
import { ThemeToggle } from "@/components/theme-toggle";
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
      <PageEnter className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-5">
        <div className="border-b border-[var(--desk-border)] pb-4">
          <p className="font-mono text-[0.65rem] tracking-[0.2em] text-[var(--desk-live)] uppercase">
            Account
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--desk-text)] sm:text-2xl">
            Profile &amp; settings
          </h1>
          <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
            Signed in with Google via Supabase.
          </p>
        </div>

        <section className="flex flex-col gap-5 rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)] p-5">
          <div className="flex items-center gap-4">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                className="size-14 rounded-full border border-[var(--desk-border)] object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex size-14 items-center justify-center rounded-full border border-[var(--desk-border)] bg-[linear-gradient(145deg,#3a3a3a,#141414)] font-mono text-xl text-[var(--desk-text)]">
                {initial}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-medium text-[var(--desk-text)]">
                {user.displayName ?? user.email}
              </p>
              <p className="truncate font-mono text-xs text-[var(--desk-text-muted)]">
                {user.email}
              </p>
            </div>
            <span className="ml-auto rounded-sm border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-2 py-1 font-mono text-[0.6rem] tracking-[0.12em] text-[var(--desk-text-dim)] uppercase">
              {user.isAdmin ? "Admin" : "Member"} · {user.subscription}
            </span>
          </div>

          <div className="border-t border-[var(--desk-border)] pt-5">
            <ProfileNameForm currentName={user.displayName} />
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)] p-5">
          <div>
            <h2 className="text-sm font-semibold text-[var(--desk-text)]">
              Appearance
            </h2>
            <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
              Light is the default. Your choice is saved on this device.
            </p>
          </div>
          <ThemeToggle />
        </section>

        <section className="rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)] p-5">
          <h2 className="text-sm font-semibold text-[var(--desk-text)]">
            Coming soon
          </h2>
          <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
            Preferences we&apos;re building next.
          </p>
          <ul className="mt-4 flex flex-col divide-y divide-[var(--desk-border)]">
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

        <section className="rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)] p-5">
          <h2 className="text-sm font-semibold text-[var(--desk-text)]">
            Session
          </h2>
          <p className="mt-1 max-w-xl text-sm text-[var(--desk-text-muted)]">
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
      <span className="mt-0.5 text-[var(--desk-text-dim)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[var(--desk-text)]">{title}</p>
        <p className="text-xs text-[var(--desk-text-muted)]">{description}</p>
      </div>
      <span className="rounded-sm border border-[var(--desk-border-strong)] px-1.5 py-0.5 font-mono text-[0.55rem] tracking-[0.1em] text-[var(--desk-text-dim)] uppercase">
        Soon
      </span>
    </li>
  );
}
