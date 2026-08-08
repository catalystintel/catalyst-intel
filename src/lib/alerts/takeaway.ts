/**
 * Cheap alert one-liner: prefer cached AI triage, else deterministic WIIM.
 * Never calls OpenRouter on the fire path (latency + free-tier limits).
 */

import { deriveWhyMoving } from "@/lib/catalysts/article-funnel";

export function resolveAlertTakeaway(input: {
  aiBullets?: string[] | null;
  summary?: string | null;
  headline?: string | null;
  title?: string | null;
}): string | null {
  const firstBullet = input.aiBullets?.find(
    (b) => typeof b === "string" && b.trim().length > 0,
  );
  if (firstBullet) return firstBullet.trim().slice(0, 220);

  return deriveWhyMoving({
    summary: input.summary,
    headline: input.headline,
    title: input.title,
  });
}
