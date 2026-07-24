import type { EventCategoryKey } from "@/lib/catalysts/taxonomy";
import { cn } from "@/lib/utils";

type SectorTone = EventCategoryKey | "sector" | "sec";

/** Mono desk: grayscale pills only — no rainbow category colors. */
const TONE_STYLES: Record<SectorTone, string> = {
  distress:
    "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)]",
  trading_halt:
    "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)]",
  earnings:
    "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)]",
  regulatory:
    "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)]",
  deals:
    "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)]",
  clinical:
    "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)]",
  macro:
    "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)]",
  analyst:
    "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)]",
  restructuring:
    "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)]",
  capital:
    "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)]",
  insider:
    "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)]",
  management:
    "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)]",
  governance:
    "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)]",
  news: "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)]",
  disclosure:
    "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-muted)]",
  other:
    "border-[var(--desk-border)] bg-transparent text-[var(--desk-text-muted)]",
  sector:
    "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)]",
  sec: "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)]",
};

interface SectorPillProps {
  label: string;
  tone: SectorTone;
  className?: string;
}

/**
 * Rounded sector / event pill for blotter columns (B&W desk).
 */
export function SectorPill({ label, tone, className }: SectorPillProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-sm border px-1.5 py-0.5 font-mono text-[0.7rem] font-medium tracking-wide",
        TONE_STYLES[tone],
        className,
      )}
      title={label}
    >
      {label}
    </span>
  );
}
