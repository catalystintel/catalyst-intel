import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logout } from "@/app/login/actions";

export function AppHeader({
  email,
  role,
}: {
  email: string;
  role: "user" | "admin";
}) {
  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-3">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
          Catalyst Intel
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">
            Dashboard
          </Link>
          {role === "admin" ? (
            <Link href="/admin" className="hover:text-foreground">
              Admin
            </Link>
          ) : null}
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>{email}</span>
        <form action={logout}>
          <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
