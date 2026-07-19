"use client";

import { useState } from "react";
import posthog from "posthog-js";

import { Button } from "@/components/ui/button";

interface FetchResult {
  fetched: number;
  inserted: number;
  skipped: number;
  errors: number;
  ranAt: string;
}

export function FetchTrigger() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FetchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch() {
    setLoading(true);
    setError(null);
    posthog.capture("sec_edgar_fetch_triggered");
    try {
      const res = await fetch("/api/admin/fetch/sec-edgar", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Fetch job failed.");
      }
      setResult(data);
      posthog.capture("sec_edgar_fetch_completed", {
        fetched: data.fetched,
        inserted: data.inserted,
        skipped: data.skipped,
        errors: data.errors,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fetch job failed.";
      setError(message);
      posthog.capture("sec_edgar_fetch_error", { error_message: message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={handleFetch} disabled={loading} className="w-fit">
        {loading ? "Fetching..." : "Fetch SEC EDGAR now"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {result ? (
        <dl className="grid w-fit grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-border p-4 text-sm">
          <dt className="text-muted-foreground">Fetched</dt>
          <dd>{result.fetched}</dd>
          <dt className="text-muted-foreground">Inserted</dt>
          <dd>{result.inserted}</dd>
          <dt className="text-muted-foreground">Skipped (dupes)</dt>
          <dd>{result.skipped}</dd>
          <dt className="text-muted-foreground">Errors</dt>
          <dd>{result.errors}</dd>
          <dt className="text-muted-foreground">Ran at</dt>
          <dd>{new Date(result.ranAt).toLocaleTimeString()}</dd>
        </dl>
      ) : null}
    </div>
  );
}
