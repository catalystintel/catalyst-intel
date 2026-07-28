import { Zap } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Primary sign-up CTA — used both in the hero (with icon + subtext) and the
 * final section near the footer (plain single line).
 *
 * Styled with the desk's gold/amber accent (`--desk-live`), matching the
 * LIVE badges, DETAILS buttons, and the About page's final CTA — so the
 * one CTA on the page reads as part of the product, not a generic OAuth
 * widget bolted on top of it.
 */
export function LandingGoogleCta({
  children = "Continue with Google — free",
  subtext,
  showIcon = false,
  className,
}: {
  children?: React.ReactNode;
  /** Optional second line under the label — hero usage only. */
  subtext?: string;
  /** Optional leading lightning-bolt icon — hero usage only. */
  showIcon?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/login"
      className={cn(
        buttonVariants({ size: "lg" }),
        "btn-press h-auto min-h-11 flex-col justify-center gap-0.5 bg-[var(--desk-live)] px-6 py-2.5 text-[0.95rem] font-semibold tracking-tight text-[#1a1520] shadow-[0_1px_2px_rgba(0,0,0,0.12),0_8px_24px_rgba(240,193,75,0.22)]",
        "hover:bg-[#f5cc63] focus-visible:ring-2 focus-visible:ring-[var(--desk-live)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--desk-app)] focus-visible:outline-none",
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
        <span className="text-[0.7rem] font-medium tracking-tight text-[#1a1520]/75">
          {subtext}
        </span>
      ) : null}
    </Link>
  );
}
