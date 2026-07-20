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
  purgedCatalysts: number;
  purgedRawSources: number;
}

interface NyseFetchResult {
  configured: boolean;
  fetched: number;
  nyseFiltered: number;
  upserted: number;
  quoted: number;
  quoteErrors: number;
  ranAt: string;
  message?: string;
}

export function FetchTrigger() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FetchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [nyseLoading, setNyseLoading] = useState(false);
  const [nyseResult, setNyseResult] = useState<NyseFetchResult | null>(null);
  const [nyseError, setNyseError] = useState<string | null>(null);

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

  async function handleNyseFetch() {
    setNyseLoading(true);
    setNyseError(null);
    posthog.capture("finnhub_nyse_fetch_triggered");
    try {
      const res = await fetch("/api/admin/fetch/finnhub-nyse", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "NYSE fetch failed.");
      }
      setNyseResult(data);
      posthog.capture("finnhub_nyse_fetch_completed", {
        configured: data.configured,
        upserted: data.upserted,
        quoted: data.quoted,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "NYSE fetch failed.";
      setNyseError(message);
      posthog.capture("finnhub_nyse_fetch_error", { error_message: message });
    } finally {
      setNyseLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Button
          onClick={handleFetch}
          disabled={loading}
          className="btn-press w-fit bg-[var(--desk-live)] text-[#121212] hover:brightness-110"
        >
          {loading ? "Fetching…" : "Fetch SEC EDGAR now"}
        </Button>
        {error ? (
          <p className="font-mono text-sm text-destructive">{error}</p>
        ) : null}
        {result ? (
          <dl className="grid w-fit grid-cols-2 gap-x-8 gap-y-1.5 border border-border/70 bg-background/40 p-4 font-mono text-sm">
            <dt className="text-muted-foreground">Fetched</dt>
            <dd className="tabular-nums">{result.fetched}</dd>
            <dt className="text-muted-foreground">Inserted</dt>
            <dd className="tabular-nums">{result.inserted}</dd>
            <dt className="text-muted-foreground">Skipped</dt>
            <dd className="tabular-nums">{result.skipped}</dd>
            <dt className="text-muted-foreground">Errors</dt>
            <dd className="tabular-nums">{result.errors}</dd>
            <dt className="text-muted-foreground">Ran at</dt>
            <dd className="tabular-nums">
              {new Date(result.ranAt).toLocaleTimeString()}
            </dd>
            <dt className="text-muted-foreground">Purged (30d+)</dt>
            <dd className="tabular-nums">
              {result.purgedCatalysts} catalysts / {result.purgedRawSources}{" "}
              sources
            </dd>
          </dl>
        ) : null}
      </div>

      <div className="border-t border-[var(--desk-border)] pt-6">
        <h3 className="font-mono text-sm tracking-wide text-[var(--desk-text)]">
          Finnhub · NYSE listings
        </h3>
        <p className="mt-1 max-w-xl text-sm text-[var(--desk-text-muted)]">
          Pull US symbols filtered to NYSE (MIC XNYS). Requires{" "}
          <code className="font-mono text-[0.8em] text-[var(--desk-text-secondary)]">
            FINNHUB_API_KEY
          </code>
          . Soft-fails with a clear message when unset.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          <Button
            onClick={handleNyseFetch}
            disabled={nyseLoading}
            variant="outline"
            className="btn-press w-fit border-[var(--desk-border-strong)] bg-transparent text-[var(--desk-text)] hover:bg-white/[0.05]"
          >
            {nyseLoading ? "Fetching…" : "Fetch NYSE listings now"}
          </Button>
          {nyseError ? (
            <p className="font-mono text-sm text-destructive">{nyseError}</p>
          ) : null}
          {nyseResult ? (
            nyseResult.configured ? (
              <dl className="grid w-fit grid-cols-2 gap-x-8 gap-y-1.5 border border-border/70 bg-background/40 p-4 font-mono text-sm">
                <dt className="text-muted-foreground">US symbols</dt>
                <dd className="tabular-nums">{nyseResult.fetched}</dd>
                <dt className="text-muted-foreground">NYSE filtered</dt>
                <dd className="tabular-nums">{nyseResult.nyseFiltered}</dd>
                <dt className="text-muted-foreground">Upserted</dt>
                <dd className="tabular-nums">{nyseResult.upserted}</dd>
                <dt className="text-muted-foreground">Quoted</dt>
                <dd className="tabular-nums">{nyseResult.quoted}</dd>
                <dt className="text-muted-foreground">Quote errors</dt>
                <dd className="tabular-nums">{nyseResult.quoteErrors}</dd>
                <dt className="text-muted-foreground">Ran at</dt>
                <dd className="tabular-nums">
                  {new Date(nyseResult.ranAt).toLocaleTimeString()}
                </dd>
              </dl>
            ) : (
              <p className="max-w-lg rounded-md border border-[var(--desk-border-strong)] bg-white/[0.03] px-3 py-2 text-sm text-[var(--desk-text-muted)]">
                {nyseResult.message ??
                  "FINNHUB_API_KEY is not set. Add it to enable NYSE listings."}
              </p>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
