import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Primary sign-up CTA — the single prominent CTA on the pre-login landing
 * page (final section, near the footer).
 *
 * Styled with the desk's gold/amber accent (`--desk-live`), matching the
 * LIVE badges, DETAILS buttons, and the About page's final CTA — so the
 * one CTA on the page reads as part of the product, not a generic OAuth
 * widget bolted on top of it.
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
        buttonVariants({ size: "lg" }),
        "btn-press min-h-11 justify-center bg-[var(--desk-live)] px-6 text-[0.95rem] font-semibold tracking-tight text-[#1a1520] shadow-[0_1px_2px_rgba(0,0,0,0.12),0_8px_24px_rgba(240,193,75,0.22)]",
        "hover:bg-[#f5cc63] focus-visible:ring-2 focus-visible:ring-[var(--desk-live)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--desk-app)] focus-visible:outline-none",
        className,
      )}
    >
      {children}
    </Link>
  );
}
