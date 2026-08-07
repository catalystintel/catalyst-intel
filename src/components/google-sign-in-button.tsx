"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/google-icon";
import { toUserFacingMessage } from "@/lib/errors/user-facing";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { googleOAuthOptions } from "@/lib/supabase/google-oauth";

/**
 * Starts Google OAuth from the browser so the PKCE verifier is written to
 * first-party cookies before leaving for Google — more reliable on iOS Safari
 * than a Server Action + redirect(). Falls back to /auth/login if JS fails.
 *
 * Always requests Google's account chooser (`prompt=select_account`) and clears
 * any local Supabase session first so a prior Google login cannot silently
 * reuse the wrong address.
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
        // Drop a stale local session so switching Google accounts replaces it
        // instead of bouncing back into the previous desk session.
        await supabase.auth.signOut({ scope: "local" });
        const { data, error: oauthError } = await supabase.auth.signInWithOAuth(
          {
            provider: "google",
            options: {
              ...googleOAuthOptions(
                `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
              ),
              // We navigate explicitly after signOut so the first click always
              // leaves for Google (avoids a no-op when auto-redirect races).
              skipBrowserRedirect: true,
            },
          },
        );

        if (oauthError || !data?.url) {
          setError(
            toUserFacingMessage(
              oauthError?.message ?? "Could not start Google sign-in.",
              "Could not start Google sign-in.",
            ),
          );
          window.location.assign(fallbackHref);
          return;
        }

        window.location.assign(data.url);
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
        className="btn-press min-h-11 w-full gap-2.5 bg-[var(--landing-primary,#2563eb)] text-white shadow-[0_1px_2px_rgba(0,0,0,0.25),0_4px_14px_rgba(37,99,235,0.14)] hover:bg-[var(--landing-primary-hover,#1d4ed8)] focus-visible:ring-[var(--landing-primary,#2563eb)]"
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
