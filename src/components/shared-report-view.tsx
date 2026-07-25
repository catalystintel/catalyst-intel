"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CategoryBadge } from "@/components/category-badge";
import { MaterialityBadge } from "@/components/materiality-badge";
import { SkeletonCard } from "@/components/loading-skeleton";
import type { ReportDetail } from "@/lib/reports/types";
import { formatEventTime, formatRelativeAge } from "@/lib/format/relative-time";

export function SharedReportView({ token }: { token: string }) {
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/reports/share/${encodeURIComponent(token)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Report not found.");
        setReport(data.report as ReportDetail);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Report not found.");
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [token]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3 p-4 sm:p-5">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-3 px-4 py-20 text-center">
        <p className="text-lg font-semibold text-[var(--desk-text)]">
          Report unavailable
        </p>
        <p className="text-sm text-[var(--desk-text-muted)]">
          {error ?? "This share link is invalid or was deleted."}
        </p>
        <Link
          href="/reports"
          className="mt-2 font-mono text-[0.75rem] tracking-wide text-[var(--desk-live)] uppercase hover:underline"
        >
          Back to Reports
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 sm:p-5">
      <div className="border-b border-[var(--desk-border)] pb-4">
        <p className="font-mono text-[0.65rem] tracking-[0.2em] text-[var(--desk-live)] uppercase">
          Shared digest
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--desk-text)] sm:text-2xl">
          {report.title}
        </h1>
        <p className="mt-1 font-mono text-[0.72rem] text-[var(--desk-text-dim)]">
          {report.itemCount} catalysts · {report.window} · {report.scope} ·
          frozen {formatEventTime(report.createdAt)}
        </p>
      </div>

      <ul className="divide-y divide-[var(--desk-border)] overflow-hidden rounded-md border border-[var(--desk-border)] bg-[var(--desk-panel)]">
        {report.items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/catalyst-feed/catalyst/${item.id}`}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] gap-3 px-4 py-3 transition-colors hover:bg-[var(--desk-overlay-soft)] sm:grid-cols-[5rem_minmax(0,1fr)_auto_5rem]"
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
              <span className="pt-0.5 text-right font-mono text-[0.72rem] text-[var(--desk-text-muted)] tabular-nums">
                {formatRelativeAge(item.timestamp, now)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
