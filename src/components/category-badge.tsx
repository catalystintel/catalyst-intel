import {
  CATEGORY_LABELS,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";
import { cn } from "@/lib/utils";

/** Mono desk: grayscale category chips (no rainbow). */
const CATEGORY_STYLES: Record<EventCategoryKey, string> = {
  distress:
    "border-[var(--desk-border-strong)] bg-white/[0.04] text-[var(--desk-text-secondary)]",
  trading_halt:
    "border-[var(--desk-border-strong)] bg-white/[0.04] text-[var(--desk-text-secondary)]",
  earnings:
    "border-[var(--desk-border-strong)] bg-white/[0.04] text-[var(--desk-text-secondary)]",
  regulatory:
    "border-[var(--desk-border-strong)] bg-white/[0.04] text-[var(--desk-text-secondary)]",
  deals:
    "border-[var(--desk-border-strong)] bg-white/[0.04] text-[var(--desk-text-secondary)]",
  clinical:
    "border-[var(--desk-border-strong)] bg-white/[0.04] text-[var(--desk-text-secondary)]",
  macro:
    "border-[var(--desk-border-strong)] bg-white/[0.04] text-[var(--desk-text-secondary)]",
  analyst:
    "border-[var(--desk-border-strong)] bg-white/[0.04] text-[var(--desk-text-secondary)]",
  restructuring:
    "border-[var(--desk-border-strong)] bg-white/[0.04] text-[var(--desk-text-secondary)]",
  capital:
    "border-[var(--desk-border-strong)] bg-white/[0.04] text-[var(--desk-text-secondary)]",
  insider:
    "border-[var(--desk-border-strong)] bg-white/[0.04] text-[var(--desk-text-secondary)]",
  management:
    "border-[var(--desk-border-strong)] bg-white/[0.04] text-[var(--desk-text-secondary)]",
  governance:
    "border-[var(--desk-border)] bg-transparent text-[var(--desk-text-muted)]",
  news: "border-[var(--desk-border)] bg-transparent text-[var(--desk-text-muted)]",
  disclosure:
    "border-[var(--desk-border)] bg-transparent text-[var(--desk-text-muted)]",
  other:
    "border-[var(--desk-border)] bg-transparent text-[var(--desk-text-muted)]",
};

interface CategoryBadgeProps {
  category: EventCategoryKey;
  className?: string;
}

/**
 * Compact mono pill for a catalyst's event category.
 */
export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 font-mono text-[0.6rem] tracking-[0.08em] uppercase",
        CATEGORY_STYLES[category],
        className,
      )}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}
