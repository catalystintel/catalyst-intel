import Link from "next/link";

import { GoogleIcon } from "@/components/google-icon";
import { cn } from "@/lib/utils";

/**
 * Primary sign-up CTA for the pre-login landing page.
 *
 * Deliberately Google-brand blue (not the desk gold): gold is reserved for
 * LIVE / high-materiality catalyst semantics, while blue reads as the
 * trusted "sign in with Google" affordance and stands apart from every
 * other accent on the page.
 */
export function LandingGoogleCta({
  children = "Continue with Google — free",
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href="/login"
      className={cn(
        "btn-press inline-flex min-h-12 items-center justify-center gap-3 rounded-md bg-[#1a73e8] px-6 text-[0.95rem] font-semibold tracking-tight text-white shadow-[0_1px_2px_rgba(26,115,232,0.3),0_8px_24px_rgba(26,115,232,0.22)]",
        "hover:bg-[#1765cc] focus-visible:ring-2 focus-visible:ring-[#1a73e8] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--desk-app)] focus-visible:outline-none",
        className,
      )}
    >
      <span
        aria-hidden
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm bg-white"
      >
        <GoogleIcon className="size-3.5" />
      </span>
      {children}
    </Link>
  );
}
