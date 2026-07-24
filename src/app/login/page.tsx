import Link from "next/link";

import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { buttonVariants } from "@/components/ui/button";
import {
  getDevBypassEmail,
  isDevAuthBypassEnabled,
} from "@/lib/auth/dev-bypass";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const { error, message, next } = await searchParams;
  const configured = isSupabaseConfigured();
  const devBypass = isDevAuthBypassEnabled();
  const destination = next ?? "/dashboard";

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col overflow-x-hidden bg-[var(--desk-app)]">
      <div
        aria-hidden
        className="desk-grid pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[40vh] bg-[radial-gradient(ellipse_at_top,var(--desk-glow),transparent_65%)]"
      />

      <header className="relative z-10 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:px-8 sm:py-5">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2.5 text-sm font-bold tracking-tight text-[var(--desk-text)]"
        >
          <span
            aria-hidden
            className="brand-mark relative size-7 shrink-0 rounded-lg"
          />
          Catalyst Intel
        </Link>
      </header>

      <main className="page-enter relative z-10 flex flex-1 items-center justify-center px-4 pb-[max(4rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-sm rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(240,193,75,0.35)] bg-[rgba(240,193,75,0.12)] px-2.5 py-1 text-[0.68rem] font-bold tracking-[0.08em] text-[var(--desk-live)]">
            <span
              aria-hidden
              className="live-pulse size-1.5 rounded-full bg-[var(--desk-live)]"
            />
            LIVE
          </span>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-[var(--desk-text)]">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-[var(--desk-text-muted)]">
            Continue with Google to open the Latest News feed.
          </p>

          <div className="mt-6 flex flex-col gap-4">
            {devBypass ? (
              <div className="flex flex-col gap-3 rounded-md border border-amber-400/40 bg-amber-400/10 p-3">
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Dev auth bypass is on
                  </p>
                  <p className="mt-1 font-mono text-xs break-all text-amber-800/80 dark:text-amber-200/80">
                    {getDevBypassEmail()}
                  </p>
                </div>
                <Link
                  href={destination}
                  className={cn(buttonVariants(), "btn-press w-full")}
                >
                  Enter as dev user
                </Link>
              </div>
            ) : null}

            {!configured ? (
              <div className="border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium">Supabase Auth is not configured</p>
                <p className="mt-1 text-destructive/90">
                  Put your real project URL and anon key in{" "}
                  <code className="text-xs">.env.local</code>, enable Google
                  under Authentication → Providers, add{" "}
                  <code className="text-xs">
                    http://localhost:3000/auth/callback
                  </code>{" "}
                  and{" "}
                  <code className="text-xs">
                    https://catalyst-intel.vercel.app/auth/callback
                  </code>{" "}
                  to Redirect URLs, then restart the dev server.
                </p>
              </div>
            ) : null}

            {message ? (
              <p className="text-sm text-muted-foreground">{message}</p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <GoogleSignInButton next={destination} configured={configured} />
          </div>
        </div>
      </main>
    </div>
  );
}
