"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const looksLikeDb =
    /local\.db|LIBSQL|Turso|Database is not configured|ConnectionFailed/i.test(
      error.message,
    );

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg rounded-lg border border-border p-6 text-sm">
        <h1 className="text-base font-semibold tracking-tight">
          {looksLikeDb ? "Database unavailable" : "Something went wrong"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {looksLikeDb
            ? "This deployment needs a hosted Turso database. Set LIBSQL_URL and LIBSQL_AUTH_TOKEN in Vercel, migrate, and redeploy (see DEPLOYMENT.md)."
            : error.message || "An unexpected error occurred."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 text-sm font-medium underline underline-offset-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
