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
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="group flex items-center gap-2 text-sm font-semibold tracking-tight transition-colors hover:text-amber-400"
          >
            <span
              aria-hidden
              className="inline-block size-2 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.55)] transition-transform group-hover:scale-110"
            />
            Catalyst Intel
          </Link>
          <nav className="flex items-center gap-1 text-sm">
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
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60",
            active === "profile" ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Google avatar URL from OAuth metadata
            <img
              src={avatarUrl}
              alt=""
              className="size-7 rounded-full border border-border object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex size-7 items-center justify-center rounded-full border border-border bg-secondary font-mono text-xs text-amber-300">
              {initial}
            </span>
          )}
          <span className="hidden max-w-[10rem] truncate sm:inline">{label}</span>
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
          ? "bg-muted/70 text-foreground"
          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
