import type { MacroEventDef } from "@/lib/jobs/fetch-macro-calendar";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<MacroEventDef["subcategory"], string> = {
  cpi: "BLS",
  nfp: "BLS",
  fomc: "Federal Reserve",
};

const TAG_LABEL: Record<MacroEventDef["subcategory"], string> = {
  cpi: "CPI",
  nfp: "Jobs (NFP)",
  fomc: "FOMC",
};

/**
 * "ECONOMIC CALENDAR" panel — maps to the reference image's Economic
 * Calendar + Economic Data panels, consolidated into one real, functional
 * panel: the desk's own keyless CPI / Jobs (NFP) / FOMC schedule
 * (`buildUpcomingMacroEvents`, same source already ingested into the Live
 * tape as "Macro" catalysts). No separate mock "Economic Data" widget —
 * we only show numbers we actually have.
 */
export function DashboardEconomicCalendar({
  events,
}: {
  events: MacroEventDef[];
}) {
  return (
    <section className="flex max-h-[42%] min-h-[200px] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--desk-border)] bg-[var(--desk-header)] px-3 py-2.5">
        <h2 className="desk-caps font-mono text-[0.7rem] font-semibold tracking-[0.14em] text-[var(--desk-text)] uppercase">
          Economic Calendar
        </h2>
        <span className="desk-data tracking-wide text-[var(--desk-text-dim)] uppercase">
          CPI · NFP · FOMC
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {events.length === 0 ? (
          <p className="desk-data p-3 text-[var(--desk-text-dim)]">
            No scheduled releases in the lookahead window.
          </p>
        ) : (
          <ul className="flex flex-col">
            {events.map((event) => (
              <li
                key={event.id}
                className="border-b border-[var(--desk-border)] px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="desk-body leading-snug text-[var(--desk-text-secondary)]">
                    {event.title}
                  </p>
                  <span
                    className={cn(
                      "desk-data shrink-0 rounded-sm border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-1.5 py-0.5 tracking-[0.08em] text-[var(--desk-text-muted)] uppercase",
                    )}
                  >
                    {TAG_LABEL[event.subcategory]}
                  </span>
                </div>
                <p className="desk-data mt-1 tracking-wide text-[var(--desk-text-dim)]">
                  {formatEventDate(event.date)} · {formatTimeEt(event.timeEt)}{" "}
                  ET · {SOURCE_LABEL[event.subcategory]}
                </p>
              </li>
            ))}
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
