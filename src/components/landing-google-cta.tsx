import { Zap } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Primary sign-up CTA — used both in the hero (with icon + subtext) and the
 * final section near the footer (plain single line).
 *
 * Uses landing primary blue (`--landing-primary` / `#2563EB`), not LIVE amber.
 * Amber stays reserved for LIVE / warning chips on the prelogin surface.
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
        "btn-press h-auto min-h-11 flex-col justify-center gap-0.5 bg-[var(--landing-primary,#2563eb)] px-6 py-2.5 text-[0.95rem] font-semibold tracking-tight text-[#f8fafc] shadow-[0_1px_2px_rgba(0,0,0,0.25),0_4px_14px_rgba(37,99,235,0.14)]",
        "hover:bg-[var(--landing-primary-hover,#1d4ed8)] focus-visible:ring-2 focus-visible:ring-[var(--landing-primary,#2563eb)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--desk-app)] focus-visible:outline-none",
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
        <span className="text-[0.7rem] font-medium tracking-tight text-[#f8fafc]/80">
          {subtext}
        </span>
      ) : null}
    </Link>
  );
}
