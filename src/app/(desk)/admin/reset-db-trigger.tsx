"use client";

import { useId, useState } from "react";
import posthog from "posthog-js";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DB_RESET_CONFIRM_PHRASE } from "@/lib/ops/non-production-env";

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

type PendingAction = { runIngest: boolean } | null;

export function ResetDbTrigger() {
  const confirmInputId = useId();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResetResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [confirmText, setConfirmText] = useState("");

  const confirmOpen = pending !== null;
  const confirmMatches = confirmText === DB_RESET_CONFIRM_PHRASE;

  function openConfirm(runIngest: boolean) {
    setConfirmText("");
    setPending({ runIngest });
  }

  function closeConfirm() {
    if (loading) return;
    setPending(null);
    setConfirmText("");
  }

  async function runReset(runIngest: boolean) {
    setLoading(true);
    setError(null);
    setResult(null);
    posthog.capture("db_reset_triggered", { run_ingest: runIngest });
    try {
      const res = await fetch("/api/admin/reset-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runIngest,
          confirm: DB_RESET_CONFIRM_PHRASE,
        }),
      });
      const data = (await res.json()) as ResetResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Reset failed.");
      }
      setResult(data);
      setPending(null);
      setConfirmText("");
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
        Admin only. Wipes catalysts / raw sources / watermarks / ingestion runs,
        applies pending migrations, then optionally re-runs multi-source ingest.
        Works in every environment — type{" "}
        <code className="font-mono text-[var(--desk-text-secondary)]">
          {DB_RESET_CONFIRM_PHRASE}
        </code>{" "}
        to confirm.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => openConfirm(true)}
          disabled={loading}
          className="btn-press w-fit bg-[var(--desk-live)] text-[var(--desk-accent-fg)] hover:brightness-110"
        >
          {loading ? "Working…" : "Clear DB, migrate & fetch all"}
        </Button>
        <Button
          onClick={() => openConfirm(false)}
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

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) closeConfirm();
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!loading}>
          <DialogHeader>
            <DialogTitle>Confirm clear database</DialogTitle>
            <DialogDescription>
              {pending?.runIngest
                ? "This wipes ingest tables, applies migrations, then fetches all sources."
                : "This wipes ingest tables and applies migrations (no fetch)."}{" "}
              Cannot be undone on this database.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label
              htmlFor={confirmInputId}
              className="text-xs font-medium text-[var(--desk-text-secondary)]"
            >
              Type{" "}
              <span className="font-mono text-[var(--desk-text)]">
                {DB_RESET_CONFIRM_PHRASE}
              </span>{" "}
              to continue
            </label>
            <Input
              id={confirmInputId}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              autoFocus
              spellCheck={false}
              disabled={loading}
              placeholder={DB_RESET_CONFIRM_PHRASE}
              className="font-mono"
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  confirmMatches &&
                  pending &&
                  !loading
                ) {
                  e.preventDefault();
                  void runReset(pending.runIngest);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={closeConfirm}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!confirmMatches || loading}
              className="bg-[var(--desk-live)] text-[var(--desk-accent-fg)] hover:brightness-110 disabled:opacity-50"
              onClick={() => {
                if (!pending || !confirmMatches) return;
                void runReset(pending.runIngest);
              }}
            >
              {loading ? "Working…" : "Clear database"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
