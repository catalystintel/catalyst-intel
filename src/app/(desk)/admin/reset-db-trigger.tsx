"use client";

import { useState } from "react";
import posthog from "posthog-js";

import { Button } from "@/components/ui/button";

interface ResetResult {
  ok: true;
  environment: string;
  cleared: { clearedAt: string; tables: string[] };
  migrated: boolean;
  ingest: {
    ranAt: string;
    totals: {
      fetched: number;
      inserted: number;
      skipped: number;
      errors: number;
    };
    sources: Array<{
      source: string;
      status: string;
      inserted: number;
      skipped: number;
      errors: number;
      message?: string;
    }>;
  } | null;
}

export function ResetDbTrigger() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReset(runIngest: boolean) {
    const action = runIngest
      ? "Clear ingest tables, migrate, and fetch all sources?"
      : "Clear ingest tables and migrate (no fetch)?";
    if (
      !window.confirm(`${action}\n\nThis cannot be undone on this database.`)
    ) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    posthog.capture("db_reset_triggered", { run_ingest: runIngest });
    try {
      const res = await fetch("/api/admin/reset-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runIngest }),
      });
      const data = (await res.json()) as ResetResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Reset failed.");
      }
      setResult(data);
      posthog.capture("db_reset_completed", {
        run_ingest: runIngest,
        inserted: data.ingest?.totals.inserted,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Reset failed.";
      setError(message);
      posthog.capture("db_reset_error", { error_message: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-xl text-sm text-[var(--desk-text-muted)]">
        Non-production only. Wipes catalysts / raw sources / watermarks /
        ingestion runs, applies pending migrations, then optionally re-runs
        multi-source ingest (including PR wire when credentialed).
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => void handleReset(true)}
          disabled={loading}
          className="btn-press w-fit bg-[var(--desk-live)] text-[#121212] hover:brightness-110"
        >
          {loading ? "Working…" : "Clear DB, migrate & fetch all"}
        </Button>
        <Button
          onClick={() => void handleReset(false)}
          disabled={loading}
          variant="outline"
          className="btn-press w-fit border-[var(--desk-border-strong)] bg-transparent text-[var(--desk-text)] hover:bg-[var(--desk-overlay-strong)]"
        >
          {loading ? "Working…" : "Clear DB & migrate only"}
        </Button>
      </div>
      {error ? (
        <p className="font-mono text-sm text-destructive">{error}</p>
      ) : null}
      {result ? (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs text-[var(--desk-text-muted)]">
            Cleared {result.cleared.tables.length} tables · migrated · env{" "}
            {result.environment}
            {result.ingest
              ? ` · ingest +${result.ingest.totals.inserted}/err${result.ingest.totals.errors}`
              : " · ingest skipped"}
          </p>
          {result.ingest ? (
            <ul className="flex flex-col gap-1 font-mono text-xs text-[var(--desk-text-muted)]">
              {result.ingest.sources.map((s) => (
                <li key={s.source}>
                  <span className="text-[var(--desk-text-secondary)]">
                    {s.source}
                  </span>
                  {" · "}
                  {s.status}
                  {" · "}+{s.inserted}/skip{s.skipped}/err{s.errors}
                  {s.message ? ` — ${s.message}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
