import Link from "next/link";

import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { PreLoginChrome } from "@/components/pre-login-chrome";
import { buttonVariants } from "@/components/ui/button";
import {
  getDevBypassEmail,
  isDevAuthBypassEnabled,
} from "@/lib/auth/dev-bypass";
import { APP_NAME } from "@/lib/brand";
import { getPreferredAuthOrigin } from "@/lib/http/auth-origin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { toUserFacingMessage, USER_FACING } from "@/lib/errors/user-facing";
import { cn } from "@/lib/utils";

/**
 * Auth composition: brand-first trading-desk sign-in on the prelogin palette
 * (deep navy + blue primary). Hero is the Catalyst mark + name; Google OAuth
 * stays the single clear CTA.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const { error, message, next } = await searchParams;
  const configured = isSupabaseConfigured();
  const devBypass = isDevAuthBypassEnabled();
  const destination = next ?? "/catalyst-feed";
  const canonicalAuthOrigin = getPreferredAuthOrigin();
  const safeError = error
    ? toUserFacingMessage(error, USER_FACING.signInUnavailable)
    : null;
  const safeMessage = message
    ? toUserFacingMessage(message, USER_FACING.useProductionLogin)
    : null;

  return (
    <PreLoginChrome variant="auth" glowClassName="h-[55vh]">
      <main className="marketing-auth-enter relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-[max(3.5rem,env(safe-area-inset-bottom))] sm:px-8">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <span
            aria-hidden
            className="brand-mark marketing-brand-pulse relative size-14 shrink-0 rounded-2xl sm:size-16"
          />
          <p className="mt-5 font-mono text-[0.72rem] font-medium tracking-[0.16em] text-[var(--desk-text-muted)] uppercase">
            Trading desk
          </p>
          <h1 className="marketing-headline mt-2 text-3xl text-[var(--desk-text)] sm:text-4xl">
            {APP_NAME}
          </h1>
          <p className="desk-body mt-3 max-w-sm text-pretty text-[var(--desk-text-secondary)] sm:text-base">
            Live SEC catalysts for day traders — sign in free for full desk
            access during Open Early Access.
          </p>

          <div className="mt-8 w-full max-w-sm border-t border-[var(--desk-border-strong)] pt-7 text-left">
            <p className="font-mono text-[0.68rem] font-semibold tracking-[0.12em] text-[var(--desk-text-muted)] uppercase">
              Continue with Google
            </p>
            <p className="mt-1 text-sm text-[var(--desk-text-dim)]">
              No password. Full feed, filters, watchlists, and AI triage.
            </p>

            <div className="mt-5 flex flex-col gap-4">
              {devBypass ? (
                <div className="flex flex-col gap-3 rounded-md border border-amber-400/40 bg-amber-400/10 p-3">
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Local sign-in ready
                    </p>
                    <p className="mt-1 font-mono text-xs break-all text-amber-800/80 dark:text-amber-200/80">
                      {getDevBypassEmail()}
                    </p>
                  </div>
                  <Link
                    href={destination}
                    className={cn(buttonVariants(), "btn-press w-full")}
                  >
                    Continue to desk
                  </Link>
                </div>
              ) : null}

              {!configured ? (
                <div className="border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <p className="font-medium">Sign-in unavailable</p>
                  <p className="mt-1 text-destructive/90">
                    Put your real project URL and anon key in{" "}
                    <code className="text-xs">.env.local</code>, enable Google
                    under Authentication → Providers, add{" "}
                    <code className="text-xs">
                      http://localhost:3000/auth/callback
                    </code>{" "}
                    and{" "}
                    <code className="text-xs">
                      https://www.marveel.com/auth/callback
                    </code>{" "}
                    to Redirect URLs, then restart the dev server.
                  </p>
                </div>
              ) : null}

              {safeMessage ? (
                <p className="text-sm text-muted-foreground">{safeMessage}</p>
              ) : null}
              {safeError ? (
                <p className="text-sm text-destructive">{safeError}</p>
              ) : null}

              <GoogleSignInButton
                next={destination}
                configured={configured}
                canonicalAuthOrigin={canonicalAuthOrigin}
              />
            </div>
          </div>

          <p className="mt-8 font-mono text-[0.68rem] tracking-[0.04em] text-[var(--desk-text-dim)]">
            By continuing you open the live catalyst desk.
          </p>
        </div>
      </main>
    </PreLoginChrome>
  );
}
