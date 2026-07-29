"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/google-icon";
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
          setError(oauthError.message);
          window.location.assign(fallbackHref);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not start Google sign-in.",
        );
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
        className="btn-press min-h-11 w-full gap-2.5 bg-[#1a73e8] text-white shadow-[0_0_0_1px_rgba(240,193,75,0.18),0_8px_24px_rgba(26,115,232,0.28)] hover:bg-[#1765cc] focus-visible:ring-[#1a73e8]"
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
