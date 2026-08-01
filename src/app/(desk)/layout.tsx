import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import {
  DatabaseQuotaNotice,
  DatabaseSetupNotice,
} from "@/components/database-setup-notice";
import { isLibsqlConfigured, isLocalSqliteSetupError } from "@/db/env";
import { isLocalSqliteReady } from "@/db/local-sqlite-ready";
import { getCurrentAppUser } from "@/lib/auth/current-user";
import {
  isTursoQuotaBlockedError,
  normalizeDbError,
} from "@/lib/errors/classify-db-error";
import {
  canAccessPreviewDeployment,
  isPreviewDeployment,
} from "@/lib/ops/preview-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Shared chrome for all authenticated desk routes
 * (`/catalyst-feed`, `/admin`, `/alerts`, `/watchlist`, `/profile`).
 *
 * Keeps the real sidebar/header mounted across navigations so route
 * `loading.tsx` files only skeleton the content pane — never the chrome.
 */
export default async function DeskLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!isLibsqlConfigured() || !isLocalSqliteReady()) {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        redirect("/login");
      }
    }
    return <DatabaseSetupNotice />;
  }

  let user;
  try {
    user = await getCurrentAppUser();
  } catch (err) {
    // Empty/partial local.db, or SQLITE_READONLY after migrate while Next was
    // still holding the old file — don't 500 the whole desk chrome.
    if (isLocalSqliteSetupError(err)) {
      return <DatabaseSetupNotice />;
    }
    // Turso plan-quota BLOCKED: render a notice here. Next.js redacts Server
    // Component thrown errors in production, so throwing into error.tsx only
    // shows the generic "Something went wrong" copy.
    if (isTursoQuotaBlockedError(err)) {
      return <DatabaseQuotaNotice />;
    }
    throw normalizeDbError(err);
  }

  if (!user) {
    redirect("/login");
  }

  // Hard gate (middleware is optimistic): Preview / staging is admin-only.
  if (isPreviewDeployment() && !canAccessPreviewDeployment(user.email)) {
    redirect("/login?error=preview_admin_only");
  }

  return (
    <AppShell
      user={{
        email: user.email,
        isAdmin: user.isAdmin,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      }}
    >
      {children}
    </AppShell>
  );
}
