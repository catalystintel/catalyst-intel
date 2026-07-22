"use client";

import { useState } from "react";
import posthog from "posthog-js";

import { Button } from "@/components/ui/button";
import {
  CATALYST_SOURCE_CATALOG,
  CATALYST_SOURCE_IDS,
  FETCH_PHASES,
} from "@/lib/jobs/catalyst-sources";

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

interface FetchOrderEntry {
  order: number;
  id: string;
  label: string;
  priority: "must" | "should";
  phase: string;
  contributes: string;
}

interface FetchPhasePlan {
  id: string;
  label: string;
  mode: "parallel" | "sequential";
  sources: string[];
}

interface FetchAllResult {
  ranAt: string;
  fetchOrder?: FetchOrderEntry[];
  phases?: FetchPhasePlan[];
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
        <div className="max-w-2xl space-y-2 text-sm text-[var(--desk-text-muted)]">
          <p>
            Documented order (Must → Should). Runtime is phased: A keyless
            parallel, B Finnhub + Form4API, C Polygon news then prices.
          </p>
          <ol className="list-decimal space-y-1 pl-5 font-mono text-xs text-[var(--desk-text-secondary)]">
            {CATALYST_SOURCE_CATALOG.map((s) => (
              <li key={s.id}>
                <span className="text-[var(--desk-text)]">{s.label}</span>
                {" · "}
                {s.priority}
                {" · Phase "}
                {s.phase}
              </li>
            ))}
          </ol>
          <ul className="space-y-0.5 font-mono text-[0.7rem] text-[var(--desk-text-muted)]">
            {FETCH_PHASES.map((p) => (
              <li key={p.id}>
                Phase {p.id} ({p.mode}): {p.sources.join(" → ")}
              </li>
            ))}
          </ul>
        </div>
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
            {result.phases && result.phases.length > 0 ? (
              <p className="font-mono text-[0.7rem] text-[var(--desk-text-muted)]">
                Ran phases:{" "}
                {result.phases
                  .map((p) => `${p.id}(${p.mode}:${p.sources.join(",")})`)
                  .join(" · ")}
              </p>
            ) : null}
            <ul className="flex flex-col gap-1 font-mono text-xs text-[var(--desk-text-muted)]">
              {result.sources.map((s, idx) => {
                const meta =
                  result.fetchOrder?.find((o) => o.id === s.source) ??
                  CATALYST_SOURCE_CATALOG.find((c) => c.id === s.source);
                const rank = meta?.order ?? idx + 1;
                const label = meta && "label" in meta ? meta.label : s.source;
                return (
                  <li key={s.source}>
                    <span className="text-[var(--desk-text-secondary)]">
                      {rank}. {label}
                    </span>
                    {" · "}
                    {s.status}
                    {" · "}+{s.inserted}/skip{s.skipped}/err{s.errors}
                    {s.message ? ` — ${s.message}` : ""}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="border-t border-[var(--desk-border)] pt-6">
        <h3 className="font-mono text-sm tracking-wide text-[var(--desk-text)]">
          Per-source (Must→Should order)
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATALYST_SOURCE_IDS.map((source) => {
            const meta = CATALYST_SOURCE_CATALOG.find((c) => c.id === source);
            return (
              <Button
                key={source}
                onClick={() => void handleFetchSource(source)}
                disabled={loading || sourceLoading !== null}
                variant="outline"
                className="btn-press border-[var(--desk-border-strong)] bg-transparent font-mono text-xs text-[var(--desk-text)] hover:bg-white/[0.05]"
                title={meta?.contributes}
              >
                {sourceLoading === source
                  ? "…"
                  : `${meta?.order ?? ""}. ${source}`}
              </Button>
            );
          })}
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
