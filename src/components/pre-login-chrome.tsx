import Link from "next/link";

import { EarlyAccessBanner } from "@/components/early-access-banner";
import { buttonVariants } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

type PreLoginChromeProps = {
  children: React.ReactNode;
  /** Extra top glow height — landing uses a taller wash than About. */
  glowClassName?: string;
  activeNav?: "about";
  /**
   * `auth` hides the Sign In nav control (you're already there) and swaps in
   * a calm Back home link so the page reads as one brand composition.
   */
  variant?: "marketing" | "auth";
};

/** Only routes that actually exist — no placeholder "#" links. */
const FOOTER_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/about", label: "About" },
  { href: "/login", label: "Sign in" },
] as const;

export function PreLoginChrome({
  children,
  glowClassName = "h-[40vh]",
  activeNav,
  variant = "marketing",
}: PreLoginChromeProps) {
  const year = new Date().getFullYear();
  const isAuth = variant === "auth";

  return (
    // Prelogin always uses the landing fintech palette (`.prelogin-surface`)
    // regardless of the signed-in app theme toggle — `.dark` + scoped tokens
    // cascade independently of next-themes' `<html>` class. Authenticated desk
    // navy stays on `.desk-chrome` and is not overridden here.
    <div className="dark prelogin-surface relative flex min-h-dvh flex-1 flex-col overflow-x-hidden bg-[var(--desk-app)]">
      <Toaster />
      <div
        aria-hidden
        className="desk-grid pointer-events-none absolute inset-0"
      />
      {/* Soft cool wash only — purple bloom neutered for trader-fit. */}
      <div
        aria-hidden
        className={cn(
          "marketing-glow-gold pointer-events-none absolute inset-x-0 top-0",
          glowClassName,
        )}
      />
      <div
        aria-hidden
        className={cn(
          "marketing-glow-chart pointer-events-none absolute inset-x-0 top-0",
          glowClassName,
        )}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--desk-app)] to-transparent"
      />

      <EarlyAccessBanner variant="marketing" />

      <header className="relative z-10 flex items-center justify-between gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:gap-4 sm:px-8 sm:py-5">
        <Link
          href="/"
          className="marketing-headline flex min-w-0 items-center gap-2.5 text-base text-[var(--desk-text)] sm:text-lg"
        >
          <span
            aria-hidden
            className="brand-mark relative size-7 shrink-0 rounded-lg"
          />
          <span className="truncate">Catalyst Intel</span>
        </Link>
        <nav
          aria-label="Primary"
          className="flex shrink-0 items-center gap-0.5 sm:gap-2"
        >
          {isAuth ? (
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-md px-2.5 py-2 text-sm text-[var(--desk-text-secondary)] transition-colors hover:text-[var(--desk-text)] sm:min-h-0 sm:py-1.5"
            >
              Back home
            </Link>
          ) : (
            <>
              <Link
                href="/about"
                className={cn(
                  "inline-flex min-h-11 items-center rounded-md px-2.5 py-2 text-sm transition-colors sm:min-h-0 sm:py-1.5",
                  activeNav === "about"
                    ? "text-[var(--desk-text)]"
                    : "text-[var(--desk-text-secondary)] hover:text-[var(--desk-text)]",
                )}
              >
                About
              </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "btn-press min-h-11 border-[var(--desk-border-strong)] bg-transparent px-3 text-[var(--desk-text-secondary)] hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)] sm:min-h-0",
                )}
              >
                Sign In
              </Link>
            </>
          )}
        </nav>
      </header>

      {children}

      {!isAuth ? (
        <footer className="relative z-10 mt-auto border-t border-[var(--desk-border)] px-5 pt-8 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/"
                className="marketing-headline flex items-center gap-2.5 text-sm text-[var(--desk-text)]"
              >
                <span
                  aria-hidden
                  className="brand-mark relative size-6 shrink-0 rounded-md"
                />
                Catalyst Intel
              </Link>

              <nav
                aria-label="Footer"
                className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2 text-sm text-[var(--desk-text-muted)]"
              >
                {FOOTER_LINKS.map((link, index) => (
                  <span key={link.label} className="inline-flex items-center">
                    {index > 0 ? (
                      <span
                        aria-hidden
                        className="mx-2 text-[var(--desk-text-dim)]"
                      >
                        ·
                      </span>
                    ) : null}
                    <Link
                      href={link.href}
                      className="transition-colors hover:text-[var(--desk-text)]"
                    >
                      {link.label}
                    </Link>
                  </span>
                ))}
              </nav>

              <p className="font-mono text-[0.72rem] tracking-[0.04em] text-[var(--desk-text-dim)]">
                © {year} Catalyst Intel
              </p>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
