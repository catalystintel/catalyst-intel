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
};

const FOOTER_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "#", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "#", label: "Privacy" },
  { href: "#", label: "Terms" },
] as const;

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.254 2.25H8.08l4.258 5.686zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <path d="M22 12.07C22 6.48 17.52 2 11.93 2S1.86 6.48 1.86 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.02H7.9v-2.91h2.4V9.84c0-2.38 1.41-3.69 3.57-3.69 1.04 0 2.12.19 2.12.19v2.34h-1.2c-1.18 0-1.55.73-1.55 1.48v1.78h2.64l-.42 2.91h-2.22V22c4.78-.75 8.44-4.91 8.44-9.93z" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <path d="M20.32 4.37A19.8 19.8 0 0 0 15.89 3c-.2.36-.43.84-.59 1.22a18.27 18.27 0 0 0-6.6 0A12.3 12.3 0 0 0 8.1 3a19.74 19.74 0 0 0-4.44 1.38C1.25 8.11.54 11.74.9 15.32A19.9 19.9 0 0 0 6.1 18c.4-.55.76-1.13 1.07-1.74-.59-.22-1.15-.5-1.68-.82.14-.1.28-.21.41-.32 3.24 1.52 6.75 1.52 9.95 0 .14.12.28.22.41.32-.53.32-1.09.6-1.68.82.31.61.67 1.19 1.07 1.74a19.82 19.82 0 0 0 5.2-2.68c.43-4.15-.73-7.75-2.53-10.95ZM8.68 13.68c-.97 0-1.77-.9-1.77-2s.78-2.01 1.77-2.01 1.79.9 1.77 2-.78 2-1.77 2Zm6.64 0c-.97 0-1.77-.9-1.77-2s.78-2.01 1.77-2.01 1.79.9 1.77 2-.8 2-1.77 2Z" />
    </svg>
  );
}

export function PreLoginChrome({
  children,
  glowClassName = "h-[40vh]",
  activeNav,
}: PreLoginChromeProps) {
  const year = new Date().getFullYear();

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col overflow-x-hidden bg-[var(--desk-app)]">
      <Toaster />
      <div
        aria-hidden
        className="desk-grid pointer-events-none absolute inset-0"
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 bg-[radial-gradient(ellipse_at_top,var(--desk-glow),transparent_62%)]",
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
          className="flex shrink-0 items-center gap-0.5 sm:gap-2"
        >
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
            Sign in
          </Link>
        </nav>
      </header>

      {children}

      <footer className="relative z-10 mt-auto border-t border-[var(--desk-border)] px-5 pt-8 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-sm font-bold tracking-tight text-[var(--desk-text)]"
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

            <nav
              aria-label="Social"
              className="flex items-center gap-3 text-[var(--desk-text-muted)]"
            >
              <a
                href="#"
                aria-label="X (Twitter)"
                className="inline-flex size-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
              >
                <XIcon className="size-4" />
              </a>
              <a
                href="#"
                aria-label="Facebook"
                className="inline-flex size-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
              >
                <FacebookIcon className="size-4" />
              </a>
              <a
                href="#"
                aria-label="Discord"
                className="inline-flex size-9 items-center justify-center rounded-md transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
              >
                <DiscordIcon className="size-4" />
              </a>
            </nav>
          </div>

          <p className="text-center font-mono text-[0.72rem] tracking-[0.04em] text-[var(--desk-text-dim)]">
            © {year} Catalyst Intel
          </p>
        </div>
      </footer>
    </div>
  );
}
