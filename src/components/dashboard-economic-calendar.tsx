"use client";

import { X } from "lucide-react";

import type { MacroEventDef } from "@/lib/jobs/fetch-macro-calendar";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<MacroEventDef["subcategory"], string> = {
  cpi: "BLS",
  nfp: "BLS",
  ppi: "BLS",
  fomc: "Federal Reserve",
};

const TAG_LABEL: Record<MacroEventDef["subcategory"], string> = {
  cpi: "CPI",
  nfp: "Jobs (NFP)",
  ppi: "PPI",
  fomc: "FOMC",
};

function daysUntil(isoDate: string, now = new Date()): number {
  const target = Date.parse(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(target)) return Number.POSITIVE_INFINITY;
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Math.round((target - todayUtc) / 86_400_000);
}

function countdownLabel(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days}d`;
}

/**
 * Desk economic calendar: upcoming CPI / NFP / PPI / FOMC with countdown
 * and a one-line "why it matters" for the next print.
 */
export function DashboardEconomicCalendar({
  events,
  className,
  onHide,
}: {
  events: MacroEventDef[];
  className?: string;
  /** Collapse the rail; parent persists the preference. */
  onHide?: () => void;
}) {
  const nextId = events[0]?.id ?? null;

  return (
    <section
      className={cn(
        "flex max-h-[42%] min-h-[200px] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--desk-border)] bg-[var(--desk-header)] px-3 py-2.5">
        <h2 className="desk-caps min-w-0 truncate font-mono text-[0.7rem] font-semibold tracking-[0.14em] text-[var(--desk-text)] uppercase">
          Economic Calendar
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className="desk-data hidden tracking-wide text-[var(--desk-text-dim)] uppercase min-[1700px]:inline"
            title="CPI · NFP · PPI · FOMC"
          >
            CPI · NFP · PPI · FOMC
          </span>
          {onHide ? (
            <button
              type="button"
              onClick={onHide}
              title="Hide economic calendar"
              aria-label="Hide economic calendar"
              className="inline-flex size-7 items-center justify-center rounded-md text-[var(--desk-text-muted)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {events.length === 0 ? (
          <p className="desk-data p-3 text-[var(--desk-text-dim)]">
            No scheduled releases in the lookahead window.
          </p>
        ) : (
          <ul className="flex flex-col">
            {events.map((event) => {
              const days = daysUntil(event.date);
              const isNext = event.id === nextId;
              return (
                <li
                  key={event.id}
                  className={cn(
                    "border-b border-[var(--desk-border)] px-3 py-2.5",
                    isNext && "bg-[var(--desk-overlay-soft)]",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="desk-body leading-snug text-[var(--desk-text-secondary)]">
                      {event.title}
                    </p>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={cn(
                          "desk-data rounded-sm border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-1.5 py-0.5 tracking-[0.08em] text-[var(--desk-text-muted)] uppercase",
                          isNext &&
                            "border-[color-mix(in_srgb,var(--desk-live)_35%,transparent)] text-[var(--desk-live)]",
                        )}
                      >
                        {TAG_LABEL[event.subcategory]}
                      </span>
                      <span
                        className={cn(
                          "font-mono text-[0.62rem] tracking-wide uppercase",
                          days <= 1
                            ? "text-[var(--desk-live)]"
                            : "text-[var(--desk-text-dim)]",
                        )}
                      >
                        {countdownLabel(days)}
                      </span>
                    </div>
                  </div>
                  <p className="desk-data mt-1 tracking-wide text-[var(--desk-text-dim)]">
                    {formatEventDate(event.date)} · {formatTimeEt(event.timeEt)}{" "}
                    ET · {SOURCE_LABEL[event.subcategory]}
                  </p>
                  {isNext ? (
                    <p className="mt-1.5 text-[0.72rem] leading-snug text-[var(--desk-text-muted)]">
                      {event.whyItMatters}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function formatEventDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeEt(timeEt: string): string {
  const [hh, mm] = timeEt.split(":").map((n) => Number(n));
  if (hh == null) return timeEt;
  const period = hh >= 12 ? "PM" : "AM";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour12}:${String(mm ?? 0).padStart(2, "0")} ${period}`;
}
