import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PreLoginChromeProps = {
  children: React.ReactNode;
  /** Extra top glow height — landing uses a taller wash than About. */
  glowClassName?: string;
  activeNav?: "about";
};

export function PreLoginChrome({
  children,
  glowClassName = "h-[40vh]",
  activeNav,
}: PreLoginChromeProps) {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[var(--desk-app)]">
      <div
        aria-hidden
        className="desk-grid pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 bg-[radial-gradient(ellipse_at_top,rgba(79,143,217,0.14),transparent_62%)]",
          glowClassName,
        )}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--desk-app)] to-transparent"
      />

      <header className="relative z-10 flex items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 text-base font-bold tracking-tight text-[var(--desk-text)] sm:text-lg"
        >
          <span
            aria-hidden
            className="brand-mark relative size-7 shrink-0 rounded-lg"
          />
          <span className="truncate">Catalyst Intel</span>
        </Link>
        <nav
          aria-label="Primary"
          className="flex shrink-0 items-center gap-1 sm:gap-2"
        >
          <Link
            href="/about"
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm transition-colors",
              activeNav === "about"
                ? "text-[var(--desk-text)]"
                : "text-[var(--desk-text-secondary)] hover:text-[var(--desk-text)]",
            )}
          >
            About us
          </Link>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "btn-press border-[var(--desk-border-strong)] bg-transparent text-[var(--desk-text-secondary)] hover:bg-white/[0.05] hover:text-[var(--desk-text)]",
            )}
          >
            Sign in
          </Link>
        </nav>
      </header>

      {children}

      <footer className="relative z-10 mt-auto border-t border-[var(--desk-border)] px-5 py-5 sm:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[0.72rem] tracking-[0.06em] text-[var(--desk-text-dim)] uppercase">
            Catalyst Intel
          </p>
          <nav aria-label="Footer" className="flex items-center gap-4">
            <Link
              href="/about"
              className="text-sm text-[var(--desk-text-muted)] transition-colors hover:text-[var(--desk-text)]"
            >
              About us
            </Link>
            <Link
              href="/login"
              className="text-sm text-[var(--desk-text-muted)] transition-colors hover:text-[var(--desk-text)]"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
