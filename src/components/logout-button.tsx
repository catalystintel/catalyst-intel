"use client";

import posthog from "posthog-js";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logout } from "@/app/login/actions";

export function LogoutButton() {
  async function handleLogout() {
    posthog.capture("user_logged_out");
    posthog.reset();
    await logout();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
    >
      Log out
    </button>
  );
}
