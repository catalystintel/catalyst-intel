"use client";

import { useState } from "react";
import posthog from "posthog-js";

import { Button } from "@/components/ui/button";
import { CATALYST_SOURCE_IDS } from "@/lib/jobs/catalyst-sources";

interface SourceResult {
  source: string;
  configured: boolean;
  status: "ok" | "skipped" | "error";
  message?: string;
  fetched: number;
  inserted: number;
  skipped: number;
  errors: number;
}

interface FetchAllResult {
  ranAt: string;
  sources: SourceResult[];
  totals: {
    fetched: number;
    inserted: number;
    skipped: number;
    errors: number;
  };
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
  const [result, setResult] = useState<FetchAllResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceLoading, setSourceLoading] = useState<string | null>(null);

  const [nyseLoading, setNyseLoading] = useState(false);
  const [nyseResult, setNyseResult] = useState<NyseFetchResult | null>(null);
  const [nyseError, setNyseError] = useState<string | null>(null);

  async function handleFetchAll() {
    setLoading(true);
    setError(null);
    posthog.capture("multi_source_fetch_triggered");
    try {
      const res = await fetch("/api/admin/fetch/all", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Fetch all failed.");
      }
      setResult(data);
      posthog.capture("multi_source_fetch_completed", {
        inserted: data.totals?.inserted,
        errors: data.totals?.errors,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fetch all failed.";
      setError(message);
      posthog.capture("multi_source_fetch_error", { error_message: message });
    } finally {
      setLoading(false);
    }
  }

  async function handleFetchSource(source: string) {
    setSourceLoading(source);
    setError(null);
    posthog.capture("source_fetch_triggered", { source });
    try {
      const res = await fetch(
        `/api/admin/fetch/${encodeURIComponent(source)}`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok && data.status !== "skipped") {
        throw new Error(data.error ?? data.message ?? "Source fetch failed.");
      }
      setResult({
        ranAt: data.ranAt ?? new Date().toISOString(),
        sources: [data],
        totals: {
          fetched: data.fetched ?? 0,
          inserted: data.inserted ?? 0,
          skipped: data.skipped ?? 0,
          errors: data.errors ?? 0,
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Source fetch failed.";
      setError(message);
    } finally {
      setSourceLoading(null);
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
          onClick={handleFetchAll}
          disabled={loading || sourceLoading !== null}
          className="btn-press w-fit bg-[var(--desk-live)] text-[#121212] hover:brightness-110"
        >
          {loading ? "Fetching…" : "Fetch all sources now"}
        </Button>
        <p className="max-w-xl text-sm text-[var(--desk-text-muted)]">
          Runs SEC EDGAR (8-K, Form 4, S-3/424B, 13D/G), Nasdaq halts, Finnhub,
          Polygon, openFDA, ClinicalTrials, and optional Form4API via{" "}
          <code className="font-mono text-[0.8em]">Promise.allSettled</code>.
          Missing API keys soft-skip.
        </p>
        {error ? (
          <p className="font-mono text-sm text-destructive">{error}</p>
        ) : null}
        {result ? (
          <div className="flex flex-col gap-3">
            <dl className="grid w-fit grid-cols-2 gap-x-8 gap-y-1.5 border border-border/70 bg-background/40 p-4 font-mono text-sm">
              <dt className="text-muted-foreground">Inserted</dt>
              <dd className="tabular-nums">{result.totals.inserted}</dd>
              <dt className="text-muted-foreground">Skipped</dt>
              <dd className="tabular-nums">{result.totals.skipped}</dd>
              <dt className="text-muted-foreground">Errors</dt>
              <dd className="tabular-nums">{result.totals.errors}</dd>
              <dt className="text-muted-foreground">Ran at</dt>
              <dd className="tabular-nums">
                {new Date(result.ranAt).toLocaleTimeString()}
              </dd>
            </dl>
            <ul className="flex flex-col gap-1 font-mono text-xs text-[var(--desk-text-muted)]">
              {result.sources.map((s) => (
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
          </div>
        ) : null}
      </div>

      <div className="border-t border-[var(--desk-border)] pt-6">
        <h3 className="font-mono text-sm tracking-wide text-[var(--desk-text)]">
          Per-source
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATALYST_SOURCE_IDS.map((source) => (
            <Button
              key={source}
              onClick={() => void handleFetchSource(source)}
              disabled={loading || sourceLoading !== null}
              variant="outline"
              className="btn-press border-[var(--desk-border-strong)] bg-transparent font-mono text-xs text-[var(--desk-text)] hover:bg-white/[0.05]"
            >
              {sourceLoading === source ? "…" : source}
            </Button>
          ))}
        </div>
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
