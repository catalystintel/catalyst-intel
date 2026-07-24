"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { IngestionRunSourceSnapshot } from "@/lib/jobs/record-ingestion-run";

const PAGE_SIZE = 20;

interface IngestionRunRow {
  id: number;
  ranAt: string;
  trigger: "cron" | "admin";
  status: "ok" | "partial" | "failed";
  fetched: number;
  inserted: number;
  skipped: number;
  errors: number;
  durationMs: number;
  sourcesJson: IngestionRunSourceSnapshot[];
}

interface RunsResponse {
  runs: IngestionRunRow[];
  nextCursor: number | null;
  pageSize: number;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusVariant(
  status: IngestionRunRow["status"],
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ok") return "default";
  if (status === "partial") return "secondary";
  return "destructive";
}

export function IngestionRunsPanel() {
  const [runs, setRuns] = useState<IngestionRunRow[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [fromLocal, setFromLocal] = useState("");
  const [toLocal, setToLocal] = useState("");

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const fetchPage = useEffectEvent(
    async (options: { cursor: number | null; replace: boolean }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (options.replace) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      if (options.cursor !== null) {
        params.set("cursor", String(options.cursor));
      }
      if (debouncedQ) params.set("q", debouncedQ);
      if (fromLocal) {
        const fromIso = localInputToIso(fromLocal);
        if (fromIso) params.set("from", fromIso);
      }
      if (toLocal) {
        const toIso = localInputToIso(toLocal);
        if (toIso) params.set("to", toIso);
      }

      try {
        const res = await fetch(
          `/api/admin/ingestion-runs?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as RunsResponse;
        setRuns((prev) =>
          options.replace ? data.runs : [...prev, ...data.runs],
        );
        setNextCursor(data.nextCursor);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load runs");
        if (options.replace) setRuns([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
  );

  useEffect(() => {
    // Defer so the initial fetch's setState is not synchronous in the effect body
    // (react-hooks/set-state-in-effect).
    const id = window.setTimeout(() => {
      void fetchPage({ cursor: null, replace: true });
    }, 0);
    return () => {
      window.clearTimeout(id);
      abortRef.current?.abort();
    };
  }, [debouncedQ, fromLocal, toLocal]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || nextCursor === null) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !loadingMore && !loading) {
          void fetchPage({ cursor: nextCursor, replace: false });
        }
      },
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor, loadingMore, loading]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <span className="font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
            Search
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="trigger, status, source…"
              className="pl-8"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
            From
          </span>
          <Input
            type="datetime-local"
            value={fromLocal}
            onChange={(e) => setFromLocal(e.target.value)}
            className="w-auto font-mono text-xs"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.65rem] tracking-wide text-muted-foreground uppercase">
            To
          </span>
          <Input
            type="datetime-local"
            value={toLocal}
            onChange={(e) => setToLocal(e.target.value)}
            className="w-auto font-mono text-xs"
          />
        </label>
        {(fromLocal || toLocal || searchInput) && (
          <button
            type="button"
            className="h-8 rounded-lg border border-border px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => {
              setSearchInput("");
              setDebouncedQ("");
              setFromLocal("");
              setToLocal("");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>When</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Fetched</TableHead>
              <TableHead className="text-right">Inserted</TableHead>
              <TableHead className="text-right">Skipped</TableHead>
              <TableHead className="text-right">Errors</TableHead>
              <TableHead className="text-right">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && runs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-8 text-center text-muted-foreground"
                >
                  <Loader2 className="mx-auto size-4 animate-spin" />
                </TableCell>
              </TableRow>
            ) : null}
            {!loading && runs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-8 text-center text-muted-foreground"
                >
                  No ingestion runs yet. Cron or Admin “Fetch all” will appear
                  here.
                </TableCell>
              </TableRow>
            ) : null}
            {runs.map((run) => {
              const open = expandedId === run.id;
              return (
                <RunRows
                  key={run.id}
                  run={run}
                  open={open}
                  onToggle={() =>
                    setExpandedId((id) => (id === run.id ? null : run.id))
                  }
                />
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div ref={sentinelRef} className="flex h-8 items-center justify-center">
        {loadingMore ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : nextCursor === null && runs.length > 0 ? (
          <span className="font-mono text-[0.65rem] text-muted-foreground">
            End of results
          </span>
        ) : null}
      </div>
    </div>
  );
}

function RunRows({
  run,
  open,
  onToggle,
}: {
  run: IngestionRunRow;
  open: boolean;
  onToggle: () => void;
}) {
  const sources = Array.isArray(run.sourcesJson) ? run.sourcesJson : [];

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={onToggle}
        aria-expanded={open}
      >
        <TableCell className="w-8 pr-0">
          <ChevronDown
            className={cn(
              "size-3.5 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </TableCell>
        <TableCell className="font-mono text-xs tabular-nums">
          {new Date(run.ranAt).toLocaleString()}
        </TableCell>
        <TableCell className="font-mono text-xs">{run.trigger}</TableCell>
        <TableCell>
          <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
        </TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">
          {run.fetched}
        </TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">
          {run.inserted}
        </TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">
          {run.skipped}
        </TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">
          {run.errors}
        </TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">
          {formatDuration(run.durationMs)}
        </TableCell>
      </TableRow>
      {open ? (
        <TableRow className="hover:bg-transparent">
          {/* Override TableCell's default whitespace-nowrap so messages wrap. */}
          <TableCell
            colSpan={9}
            className="bg-muted/30 px-4 py-3 whitespace-normal"
          >
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sources.map((s) => (
                <li
                  key={s.source}
                  className="min-w-0 rounded-md border border-border/50 bg-[var(--desk-panel)] px-3 py-2 font-mono text-[0.7rem]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-foreground">{s.source}</span>
                    <Badge
                      variant={
                        s.status === "error"
                          ? "destructive"
                          : s.status === "skipped"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {s.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground tabular-nums">
                    f{s.fetched} · i{s.inserted} · s{s.skipped} · e{s.errors}
                  </p>
                  {s.message ? (
                    <p className="mt-1 break-words text-muted-foreground normal-case">
                      {s.message}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

/** `datetime-local` value → ISO UTC for API filters. */
function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
