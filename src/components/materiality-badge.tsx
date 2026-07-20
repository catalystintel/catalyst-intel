import { cn } from "@/lib/utils";
import {
  materialityFromScore,
  type MaterialityTier,
} from "@/lib/catalysts/materiality";
import type { EventCategoryKey } from "@/lib/jobs/parse-8k-items";

const TIER_STYLES: Record<MaterialityTier, string> = {
  high: "border-red-500/45 bg-red-500/12 text-red-300",
  medium: "border-amber-400/45 bg-amber-400/12 text-amber-200",
  low: "border-[var(--desk-border-strong)] bg-white/[0.03] text-[var(--desk-text-muted)]",
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
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[0.68rem] tracking-wide",
        TIER_STYLES[m.tier],
        className,
      )}
      title={`Rule-based materiality ${m.score}/100`}
    >
      <span className="opacity-70">{m.score}</span>
      <span className="font-medium uppercase">{m.label}</span>
    </span>
  );
}
