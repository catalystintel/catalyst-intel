"use client";

import { useState } from "react";
import posthog from "posthog-js";

import { Button } from "@/components/ui/button";

interface MigrateResult {
  ok: true;
  ranAt: string;
}

export function MigrateTrigger() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MigrateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleMigrate() {
    setLoading(true);
    setError(null);
    posthog.capture("db_migrate_triggered");
    try {
      const res = await fetch("/api/admin/migrate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Migration failed.");
      }
      setResult(data);
      posthog.capture("db_migrate_completed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Migration failed.";
      setError(message);
      posthog.capture("db_migrate_error", { error_message: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        onClick={handleMigrate}
        disabled={loading}
        variant="outline"
        className="btn-press w-fit border-[var(--desk-border-strong)] bg-transparent text-[var(--desk-text)] hover:bg-[var(--desk-overlay-strong)]"
      >
        {loading ? "Migrating…" : "Run pending migrations"}
      </Button>
      {error ? (
        <p className="font-mono text-sm text-destructive">{error}</p>
      ) : null}
      {result ? (
        <p className="font-mono text-xs text-[var(--desk-text-muted)]">
          Migrations applied · {new Date(result.ranAt).toLocaleTimeString()}
        </p>
      ) : null}
    </div>
  );
}
