"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BookmarkPlus, Copy, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CategoryBadge } from "@/components/category-badge";
import { MaterialityBadge } from "@/components/materiality-badge";
import { SkeletonCard } from "@/components/loading-skeleton";
import {
  REPORT_SCOPE_VALUES,
  REPORT_WINDOW_VALUES,
  type ReportDetail,
  type ReportScope,
  type ReportSummary,
  type ReportWindow,
} from "@/lib/reports/types";
import { formatEventTime, formatRelativeAge } from "@/lib/format/relative-time";
import { cn } from "@/lib/utils";
import { toUserFacingMessage } from "@/lib/errors/user-facing";

export function ReportsDesk() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [selected, setSelected] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [window_, setWindow] = useState<ReportWindow>("24h");
  const [scope, setScope] = useState<ReportScope>("watchlist");
  const [title, setTitle] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/reports", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load reports.");
      setReports(data.reports ?? []);
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not load reports."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadList();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadList]);

  const openReport = async (id: number) => {
    try {
      const res = await fetch(`/api/reports/${id}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not open report.");
      setSelected(data.report as ReportDetail);
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not open report."));
    }
  };

  const createReport = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          window: window_,
          scope,
          title: title.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create report.");
      const report = data.report as ReportSummary;
      const items = data.items ?? [];
      setReports((prev) => [report, ...prev]);
      setSelected({ ...report, items });
      setTitle("");
      toast.success(
        `Saved ${report.itemCount} catalyst${report.itemCount === 1 ? "" : "s"}.`,
      );
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not create report."));
    } finally {
      setCreating(false);
    }
  };

  const deleteReport = async (id: number) => {
    try {
      const res = await fetch(`/api/reports/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete report.");
      setReports((prev) => prev.filter((r) => r.id !== id));
      if (selected?.id === id) setSelected(null);
      toast.success("Report deleted.");
    } catch (err) {
      toast.error(toUserFacingMessage(err, "Could not delete report."));
    }
  };

  const copyShareLink = async (token: string) => {
    const url = `${window.location.origin}/reports/s/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied.");
    } catch {
      toast.error("Could not copy link.");
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6">
      <div className="border-b border-[var(--desk-border)] pb-4">
        <p className="font-mono text-[0.65rem] tracking-[0.2em] text-[var(--desk-live)] uppercase">
          Digests
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--desk-text)] sm:text-2xl">
          Reports
        </h1>
        <p className="mt-1 max-w-xl text-sm text-[var(--desk-text-muted)]">
          Freeze a snapshot of catalysts you&apos;re tracking — share a stable
          link without the live tape moving underneath.
        </p>
      </div>

      <div className="rounded-md border border-[var(--desk-border)] bg-[var(--desk-panel)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-2 font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
            New digest
          </p>
          {REPORT_WINDOW_VALUES.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindow(w)}
              className={cn(
                "inline-flex h-8 items-center rounded-md border px-3 font-mono text-[0.72rem] tracking-wide transition-colors",
                window_ === w
                  ? "border-[var(--desk-text-dim)] bg-[var(--desk-overlay-strong)] text-[var(--desk-text)]"
                  : "border-[var(--desk-border)] text-[var(--desk-text-muted)] hover:border-[var(--desk-border-strong)] hover:text-[var(--desk-text)]",
              )}
            >
              {w}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-[var(--desk-border)]" aria-hidden />
          {REPORT_SCOPE_VALUES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={cn(
                "inline-flex h-8 items-center rounded-md border px-3 font-mono text-[0.72rem] tracking-wide capitalize transition-colors",
                scope === s
                  ? "border-[var(--desk-live)] bg-[rgba(240,193,75,0.12)] text-[var(--desk-live)]"
                  : "border-[var(--desk-border)] text-[var(--desk-text-muted)] hover:border-[var(--desk-border-strong)] hover:text-[var(--desk-text)]",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional title…"
            maxLength={120}
            aria-label="Report title"
            className="h-9 min-w-[12rem] flex-1 rounded-md border border-[var(--desk-border)] bg-transparent px-3 text-sm text-[var(--desk-text)] placeholder:text-[var(--desk-text-dim)] focus:border-[var(--desk-border-strong)] focus:outline-none"
          />
          <button
            type="button"
            disabled={creating}
            onClick={() => void createReport()}
            className="btn-press inline-flex h-9 items-center gap-2 rounded-md border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-strong)] px-4 text-sm font-medium text-[var(--desk-text)] transition-colors hover:bg-[var(--desk-nav-active)] disabled:opacity-70"
          >
            <BookmarkPlus className="size-3.5" aria-hidden />
            {creating ? "Saving…" : "Save digest"}
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <aside className="rounded-md border border-[var(--desk-border)] bg-[var(--desk-panel)]">
          <div className="border-b border-[var(--desk-border)] px-3 py-2 font-mono text-[0.6rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
            Saved
          </div>
          {loading ? (
            <div className="space-y-2 p-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : reports.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-[var(--desk-text-muted)]">
              No digests yet. Save one from your watchlist or the full desk.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--desk-border)]">
              {reports.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => void openReport(r.id)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-[var(--desk-overlay-soft)]",
                      selected?.id === r.id && "bg-[var(--desk-overlay-soft)]",
                    )}
                  >
                    <span className="line-clamp-2 text-sm font-medium text-[var(--desk-text)]">
                      {r.title}
                    </span>
                    <span className="font-mono text-[0.65rem] text-[var(--desk-text-dim)] tabular-nums">
                      {r.itemCount} · {r.window} · {r.scope} ·{" "}
                      {formatRelativeAge(r.createdAt, now)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="min-h-0 rounded-md border border-[var(--desk-border)] bg-[var(--desk-panel)]">
          {!selected ? (
            <div className="flex h-full min-h-[16rem] items-center justify-center px-6 text-center">
              <p className="max-w-sm text-sm text-[var(--desk-text-muted)]">
                Select a saved digest, or create one. Snapshots stay frozen so a
                shared link doesn&apos;t drift with the live tape.
              </p>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--desk-border)] px-4 py-3">
                <div>
                  <h2 className="text-base font-semibold text-[var(--desk-text)]">
                    {selected.title}
                  </h2>
                  <p className="mt-0.5 font-mono text-[0.68rem] text-[var(--desk-text-dim)]">
                    {selected.itemCount} catalysts · {selected.window} ·{" "}
                    {selected.scope} · saved{" "}
                    {formatEventTime(selected.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void copyShareLink(selected.shareToken)}
                    className="btn-press inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--desk-border)] px-2.5 font-mono text-[0.68rem] text-[var(--desk-text-muted)] hover:bg-[var(--desk-overlay-soft)] hover:text-[var(--desk-text)]"
                  >
                    <Copy className="size-3" aria-hidden />
                    Copy link
                  </button>
                  <Link
                    href={`/reports/s/${selected.shareToken}`}
                    className="btn-press inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--desk-border)] px-2.5 font-mono text-[0.68rem] text-[var(--desk-text-muted)] hover:bg-[var(--desk-overlay-soft)] hover:text-[var(--desk-text)]"
                  >
                    <ExternalLink className="size-3" aria-hidden />
                    Open
                  </Link>
                  <button
                    type="button"
                    aria-label="Delete report"
                    onClick={() => void deleteReport(selected.id)}
                    className="btn-press grid size-8 place-items-center rounded-md border border-[var(--desk-border)] text-[var(--desk-text-muted)] hover:border-[var(--desk-negative)]/40 hover:text-[var(--desk-negative)]"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              </div>

              {selected.items.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-[var(--desk-text-muted)]">
                  This digest was empty when saved.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--desk-border)] overflow-y-auto">
                  {selected.items.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/catalyst-feed/catalyst/${item.id}`}
                        className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--desk-overlay-soft)] sm:grid-cols-[5rem_minmax(0,1fr)_auto_5rem]"
                      >
                        <span className="font-mono text-[0.82rem] font-semibold text-[var(--desk-text)]">
                          {item.symbol ?? "—"}
                        </span>
                        <span className="min-w-0">
                          <span className="line-clamp-2 text-sm text-[var(--desk-text)]">
                            {item.title}
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            {item.eventCategory ? (
                              <CategoryBadge category={item.eventCategory} />
                            ) : null}
                            <MaterialityBadge
                              score={item.impactScore}
                              category={item.eventCategory}
                            />
                          </span>
                        </span>
                        <span className="hidden pt-0.5 font-mono text-[0.68rem] text-[var(--desk-text-dim)] sm:inline">
                          {item.type}
                        </span>
                        <span
                          className="pt-0.5 text-right font-mono text-[0.72rem] text-[var(--desk-text-muted)] tabular-nums"
                          title={formatEventTime(item.timestamp)}
                        >
                          {formatRelativeAge(item.timestamp, now)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
