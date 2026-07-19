import { LIBSQL_SETUP_HINT } from "@/db/env";

export function DatabaseSetupNotice() {
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
