import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AppHeader({
  email,
  isAdmin,
  displayName,
  avatarUrl,
  active = "live",
}: {
  email: string;
  isAdmin: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
  active?: "live" | "admin" | "profile";
}) {
  const label = displayName?.trim() || email;
  const initial = (displayName?.trim()?.[0] || email[0] || "?").toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-[oklch(0.15_0.015_255_/0.92)] backdrop-blur-md">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-3 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <Link
            href="/dashboard"
            className="group flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight transition-colors hover:text-amber-300"
          >
            <span
              aria-hidden
              className={cn(
                "inline-block size-2 rounded-full bg-amber-400",
                active === "live" && "live-pulse",
              )}
            />
            <span className="hidden sm:inline">Catalyst Intel</span>
            <span className="sm:hidden">CI</span>
          </Link>
          <nav className="flex items-center gap-0.5 font-mono text-[0.75rem] uppercase tracking-[0.12em]">
            <NavLink href="/dashboard" active={active === "live"}>
              Live
            </NavLink>
            {isAdmin ? (
              <NavLink href="/admin" active={active === "admin"}>
                Admin
              </NavLink>
            ) : null}
          </nav>
        </div>

        <Link
          href="/profile"
          className={cn(
            "btn-press flex min-w-0 items-center gap-2 rounded-md border border-transparent px-2 py-1 text-sm transition-colors hover:border-border/70 hover:bg-muted/40",
            active === "profile"
              ? "border-border/60 bg-muted/35 text-foreground"
              : "text-muted-foreground",
          )}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Google avatar URL from OAuth metadata
            <img
              src={avatarUrl}
              alt=""
              className="size-6 rounded-sm border border-border object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex size-6 items-center justify-center rounded-sm border border-border bg-secondary font-mono text-[0.65rem] text-amber-300">
              {initial}
            </span>
          )}
          <span className="hidden max-w-[9rem] truncate font-mono text-xs sm:inline">
            {label}
          </span>
        </Link>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-2.5 py-1.5 transition-colors",
        active
          ? "bg-amber-400/12 text-amber-200"
          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
