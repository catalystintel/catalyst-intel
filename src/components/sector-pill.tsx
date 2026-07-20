import type { EventCategoryKey } from "@/lib/jobs/parse-8k-items";
import { cn } from "@/lib/utils";

type SectorTone = EventCategoryKey | "sector" | "sec";

const TONE_STYLES: Record<SectorTone, string> = {
  distress: "border-red-400/35 bg-red-400/12 text-red-300",
  earnings: "border-amber-400/35 bg-amber-400/12 text-amber-200",
  deals: "border-emerald-400/35 bg-emerald-400/12 text-emerald-300",
  restructuring: "border-orange-400/35 bg-orange-400/12 text-orange-300",
  capital: "border-sky-400/35 bg-sky-400/12 text-sky-300",
  management: "border-violet-400/35 bg-violet-400/12 text-violet-300",
  governance: "border-[#b89af0]/35 bg-[rgba(184,154,240,0.12)] text-[#b89af0]",
  disclosure:
    "border-[var(--desk-border-strong)] bg-white/[0.04] text-[var(--desk-text-muted)]",
  other:
    "border-[var(--desk-border)] bg-transparent text-[var(--desk-text-muted)]",
  sector:
    "border-[var(--desk-accent)]/28 bg-[var(--desk-accent)]/12 text-[#7eb6f0]",
  sec: "border-[var(--desk-accent)]/28 bg-[var(--desk-accent)]/12 text-[#7eb6f0]",
};

interface SectorPillProps {
  label: string;
  tone: SectorTone;
  className?: string;
}

/**
 * Rounded sector / category pill for the Latest News Sector column.
 */
export function SectorPill({ label, tone, className }: SectorPillProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-full border px-2 py-1 text-[0.75rem] font-medium",
        TONE_STYLES[tone],
        className,
      )}
      title={label}
    >
      {label}
    </span>
  );
}
