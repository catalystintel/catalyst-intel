import {
  CATEGORY_LABELS,
  type EventCategoryKey,
} from "@/lib/jobs/parse-8k-items";
import { cn } from "@/lib/utils";

// Color coding mirrors trading-desk urgency: red = distress, amber = earnings,
// steel/neutral = routine disclosure. Kept as static classes so Tailwind's
// compiler can see every variant.
const CATEGORY_STYLES: Record<EventCategoryKey, string> = {
  distress: "border-red-500/40 bg-red-500/12 text-red-300",
  earnings: "border-amber-400/45 bg-amber-400/12 text-amber-200",
  deals: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  restructuring: "border-orange-400/40 bg-orange-400/10 text-orange-300",
  capital: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  management: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  governance: "border-border/70 bg-muted/40 text-muted-foreground",
  disclosure: "border-border/70 bg-muted/30 text-muted-foreground",
  other: "border-border/60 bg-transparent text-muted-foreground/80",
};

interface CategoryBadgeProps {
  category: EventCategoryKey;
  className?: string;
}

/**
 * Compact color-coded pill for a catalyst's event category.
 *
 * @param category - The catalyst's primary event category.
 * @param className - Optional extra classes for layout tweaks.
 * @returns A styled category badge element.
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
