import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  getDevBypassEmail,
  isDevAuthBypassEnabled,
} from "@/lib/auth/dev-bypass";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

import { signInWithGoogle } from "./actions";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.86c2.26-2.08 3.56-5.14 3.56-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.92l-3.86-2.98c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.14 7.14 0 0 1 0-4.58V6.62H1.27a11.99 11.99 0 0 0 0 10.76l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.27 6.62l4 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

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
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[var(--desk-app)]">
      <div
        aria-hidden
        className="desk-grid pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[40vh] bg-[radial-gradient(ellipse_at_top,rgba(79,143,217,0.14),transparent_65%)]"
      />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-sm font-bold tracking-tight text-[var(--desk-text)]"
        >
          <span
            aria-hidden
            className="brand-mark relative size-7 shrink-0 rounded-lg"
          />
          Catalyst Intel
        </Link>
      </header>

      <main className="page-enter relative z-10 flex flex-1 items-center justify-center px-4 pb-16">
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
                  <p className="font-medium text-amber-200">
                    Dev auth bypass is on
                  </p>
                  <p className="mt-1 font-mono text-xs break-all text-amber-200/80">
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
                  to Redirect URLs, then restart the dev server.
                </p>
              </div>
            ) : null}

            <form action={signInWithGoogle} className="flex flex-col gap-4">
              <input type="hidden" name="next" value={next ?? "/dashboard"} />
              {message ? (
                <p className="text-sm text-muted-foreground">{message}</p>
              ) : null}
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <Button
                type="submit"
                variant="outline"
                className="btn-press w-full gap-2"
                disabled={!configured}
              >
                <GoogleIcon />
                Continue with Google
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
