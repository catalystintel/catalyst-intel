import { Zap } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { getSignInStartHref } from "@/lib/auth/dev-bypass";
import { cn } from "@/lib/utils";

/**
 * Primary sign-up CTA — hero and footer. Outside local bypass this starts
 * Google OAuth in one click via `/auth/login` (PKCE cookies on the redirect
 * response). With `DEV_AUTH_BYPASS`, both this and "Sign In" land on `/login`
 * so the optional desk bypass is available. Mint landing primary (`#00d4aa`)
 * with dark label text so it matches the Signal Fintech desk accent.
 */
export function LandingGoogleCta({
  children = "Continue with Google — free",
  subtext,
  showIcon = false,
  className,
  next = "/catalyst-feed",
}: {
  children?: React.ReactNode;
  /** Optional second line under the label — hero usage only. */
  subtext?: string;
  /** Optional leading lightning-bolt icon — hero usage only. */
  showIcon?: boolean;
  className?: string;
  /** Post-auth destination (safe path; /auth/login re-validates). */
  next?: string;
}) {
  return (
    <Link
      href={getSignInStartHref(next)}
      className={cn(
        buttonVariants({ size: "lg" }),
        "btn-press h-auto min-h-11 flex-col justify-center gap-0.5 bg-[var(--landing-primary,#00d4aa)] px-6 py-2.5 text-[0.95rem] font-semibold tracking-tight text-[var(--desk-accent-fg,#131722)] shadow-[0_1px_2px_rgba(0,0,0,0.25),0_4px_18px_rgba(0,212,170,0.22)]",
        "hover:bg-[var(--landing-primary-hover,#00b894)] focus-visible:ring-2 focus-visible:ring-[var(--landing-primary,#00d4aa)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--desk-app)] focus-visible:outline-none",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        {showIcon ? (
          <Zap aria-hidden className="size-4" fill="currentColor" />
        ) : null}
        {children}
      </span>
      {subtext ? (
        <span className="text-[0.7rem] font-medium tracking-tight text-[var(--desk-accent-fg,#131722)]/75">
          {subtext}
        </span>
      ) : null}
    </Link>
  );
}
