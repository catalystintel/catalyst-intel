import {
  LOCAL_DB_SETUP_HINT,
  LIBSQL_SETUP_HINT,
  databaseSetupMode,
} from "@/db/env";
import { isLocalDevUi } from "@/lib/dev/local-dev-ui";

/**
 * Rendered from the desk layout when Turso returns BLOCKED (monthly plan
 * quota). Must be a server-rendered notice — Next.js redacts Server Component
 * thrown errors in production, so `error.tsx` only sees a generic message.
 */
export function DatabaseQuotaNotice() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg rounded-lg border border-border p-6 text-sm">
        <h1 className="text-base font-semibold tracking-tight">
          Desk temporarily at capacity
        </h1>
        <p className="mt-2 text-muted-foreground">
          We can&apos;t load catalysts right now because the database has hit
          its plan limits. Please try again later.
        </p>
      </div>
    </div>
  );
}

export function DatabaseSetupNotice() {
  const mode = databaseSetupMode();
  const showOpsDetail = isLocalDevUi();

  if (mode === "local") {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          <h1 className="text-base font-semibold tracking-tight">
            {showOpsDetail ? "Local database not ready" : "Desk unavailable"}
          </h1>
          <p className="mt-2 text-destructive/90">
            {showOpsDetail
              ? LOCAL_DB_SETUP_HINT
              : "The desk can\u2019t reach its database right now. Please try again shortly."}
          </p>
          {showOpsDetail ? (
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-destructive/90">
              <li>
                From the repo root, run{" "}
                <code className="text-xs">npm run db:migrate</code>.
              </li>
              <li>
                Confirm <code className="text-xs">local.db</code> exists and is
                non-empty (a 0-byte file means migrate never applied).
              </li>
              <li>
                Restart <code className="text-xs">npm run dev</code>, then reload
                the desk.
              </li>
            </ol>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
        <h1 className="text-base font-semibold tracking-tight">
          Desk unavailable
        </h1>
        <p className="mt-2 text-destructive/90">
          {showOpsDetail
            ? LIBSQL_SETUP_HINT
            : "The desk can\u2019t reach its database right now. Please try again shortly."}
        </p>
      </div>
    </div>
  );
}
