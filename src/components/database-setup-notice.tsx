import {
  LOCAL_DB_SETUP_HINT,
  LIBSQL_SETUP_HINT,
  databaseSetupMode,
} from "@/db/env";

export function DatabaseSetupNotice() {
  const mode = databaseSetupMode();

  if (mode === "local") {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
          <h1 className="text-base font-semibold tracking-tight">
            Local database not ready
          </h1>
          <p className="mt-2 text-destructive/90">{LOCAL_DB_SETUP_HINT}</p>
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
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
        <h1 className="text-base font-semibold tracking-tight">
          Database not configured
        </h1>
        <p className="mt-2 text-destructive/90">{LIBSQL_SETUP_HINT}</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-destructive/90">
          <li>
            Create a Turso database at{" "}
            <a
              className="underline underline-offset-2"
              href="https://turso.tech"
              target="_blank"
              rel="noreferrer"
            >
              turso.tech
            </a>{" "}
            (or via the Turso CLI — see{" "}
            <code className="text-xs">DEPLOYMENT.md</code>).
          </li>
          <li>
            Set <code className="text-xs">LIBSQL_URL</code> and{" "}
            <code className="text-xs">LIBSQL_AUTH_TOKEN</code> in the Vercel
            project (Production and Preview).
          </li>
          <li>
            Run <code className="text-xs">npm run db:migrate</code> against
            those credentials, then redeploy.
          </li>
        </ol>
      </div>
    </div>
  );
}
