import { cn } from "@/lib/utils";
import {
  materialityFromScore,
  type MaterialityTier,
} from "@/lib/catalysts/materiality";
import type { EventCategoryKey } from "@/lib/jobs/parse-8k-items";

/** Accent only for High impact; Med/Low stay grayscale. */
const TIER_STYLES: Record<MaterialityTier, string> = {
  high: "border-[rgba(240,193,75,0.45)] bg-[rgba(240,193,75,0.14)] text-[var(--desk-live)]",
  medium:
    "border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] text-[var(--desk-text-secondary)]",
  low: "border-[var(--desk-border)] bg-transparent text-[var(--desk-text-muted)]",
};

export function MaterialityBadge({
  score,
  category,
  className,
}: {
  score: number | null;
  category?: EventCategoryKey | null;
  className?: string;
}) {
  const m = materialityFromScore(score, category);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[0.65rem] tracking-wide uppercase",
        TIER_STYLES[m.tier],
        className,
      )}
      title={`Materiality ${m.score}/100`}
    >
      <span className="opacity-70">{m.score}</span>
      <span className="font-semibold">{m.label}</span>
    </span>
  );
}
