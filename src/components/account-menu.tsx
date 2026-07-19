"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react";

import { logout, signOutEverywhere } from "@/app/login/actions";
import { cn } from "@/lib/utils";

interface AccountMenuProps {
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  isAdmin: boolean;
}

/**
 * Avatar-triggered account menu with profile, admin, and sign-out actions.
 *
 * Replaces the bare email chip in the header; sign-out uses the Supabase
 * server actions so it works without client-side auth state.
 *
 * @param email - Verified session email (fallback label + avatar initial).
 * @param displayName - Preferred display name when set.
 * @param avatarUrl - Google avatar URL from OAuth metadata, if any.
 * @param isAdmin - Whether to surface the admin shortcut.
 * @returns The account menu trigger and popover.
 */
export function AccountMenu({
  email,
  displayName,
  avatarUrl,
  isAdmin,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const label = displayName?.trim() || email;
  const initial = (displayName?.trim()?.[0] || email[0] || "?").toUpperCase();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "btn-press flex items-center gap-2 rounded-md border px-1.5 py-1 transition-colors",
          open
            ? "border-border/70 bg-muted/40"
            : "border-transparent hover:border-border/70 hover:bg-muted/30",
        )}
      >
        <Avatar avatarUrl={avatarUrl} initial={initial} />
        <span className="hidden max-w-[9rem] truncate text-sm text-foreground/90 sm:inline">
          {label}
        </span>
        <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 origin-top-right rounded-lg border border-border/70 bg-popover p-1.5 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
        >
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Avatar avatarUrl={avatarUrl} initial={initial} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{label}</p>
              <p className="truncate font-mono text-[0.7rem] text-muted-foreground">
                {email}
              </p>
            </div>
          </div>

          <div className="my-1 h-px bg-border/70" />

          <MenuLink href="/profile" onNavigate={() => setOpen(false)}>
            <UserRound className="size-4" />
            Profile &amp; settings
          </MenuLink>
          {isAdmin ? (
            <MenuLink href="/admin" onNavigate={() => setOpen(false)}>
              <ShieldCheck className="size-4" />
              Admin console
            </MenuLink>
          ) : null}

          <div className="my-1 h-px bg-border/70" />

          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground/90 transition-colors hover:bg-muted/50"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </form>
          <form action={signOutEverywhere}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="size-4" />
              Sign out everywhere
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function Avatar({
  avatarUrl,
  initial,
  size = "sm",
}: {
  avatarUrl?: string | null;
  initial: string;
  size?: "sm" | "lg";
}) {
  const dimensions = size === "lg" ? "size-9 text-sm" : "size-6 text-[0.65rem]";
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Google avatar URL from OAuth metadata
      <img
        src={avatarUrl}
        alt=""
        className={cn(
          "rounded-sm border border-border object-cover",
          dimensions,
        )}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-sm border border-border bg-secondary font-mono text-amber-300",
        dimensions,
      )}
    >
      {initial}
    </span>
  );
}

function MenuLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/90 transition-colors hover:bg-muted/50"
    >
      {children}
    </Link>
  );
}
