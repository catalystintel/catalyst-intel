"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/google-icon";
import { toUserFacingMessage } from "@/lib/errors/user-facing";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Starts Google OAuth from the browser so the PKCE verifier is written to
 * first-party cookies before leaving for Google — more reliable on iOS Safari
 * than a Server Action + redirect(). Falls back to /auth/login if JS fails.
 */
export function GoogleSignInButton({
  next = "/catalyst-feed",
  configured,
}: {
  next?: string;
  configured: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fallbackHref = `/auth/login?next=${encodeURIComponent(next)}`;

  function startOAuth() {
    setError(null);
    startTransition(async () => {
      if (!configured) {
        window.location.assign(fallbackHref);
        return;
      }

      try {
        const supabase = createSupabaseBrowserClient();
        const origin = window.location.origin;
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });

        if (oauthError) {
          setError(
            toUserFacingMessage(
              oauthError.message,
              "Could not start Google sign-in.",
            ),
          );
          window.location.assign(fallbackHref);
        }
      } catch (err) {
        setError(toUserFacingMessage(err, "Could not start Google sign-in."));
        window.location.assign(fallbackHref);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button
        type="button"
        size="lg"
        className="btn-press min-h-11 w-full gap-2.5 bg-[var(--landing-primary,#00d4aa)] text-[var(--desk-accent-fg,#131722)] shadow-[0_1px_2px_rgba(0,0,0,0.25),0_4px_18px_rgba(0,212,170,0.22)] hover:bg-[var(--landing-primary-hover,#00b894)] focus-visible:ring-[var(--landing-primary,#00d4aa)]"
        disabled={!configured || pending}
        onClick={startOAuth}
      >
        <span
          aria-hidden
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm bg-white"
        >
          <GoogleIcon className="size-3" />
        </span>
        {pending ? "Redirecting…" : "Continue with Google"}
      </Button>
      <noscript>
        <a
          href={fallbackHref}
          className="btn-press inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm font-medium"
        >
          Continue with Google
        </a>
      </noscript>
    </div>
  );
}
