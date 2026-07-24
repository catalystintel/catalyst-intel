import { PLATFORM_MAP, WHATS_NEW } from "@/lib/ops/whats-new";

/**
 * Admin-only skim sheet: recent ship notes + living platform map so founders
 * can stay oriented without digging through PRs.
 */
export function WhatsNewPanel() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-mono text-sm tracking-wide text-foreground">
          What&apos;s new
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Short release notes for ops and product. Newest first — edit{" "}
          <code className="font-mono text-[0.85em] text-[var(--desk-text-secondary)]">
            src/lib/ops/whats-new.ts
          </code>{" "}
          when you ship.
        </p>
        <ul className="mt-4 flex flex-col gap-5">
          {WHATS_NEW.map((entry) => (
            <li key={`${entry.date}-${entry.title}`}>
              <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                {entry.date}
              </p>
              <h3 className="mt-1 text-sm font-semibold text-foreground">
                {entry.title}
              </h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--desk-text-secondary)]">
                {entry.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t border-border/60 pt-6">
        <h2 className="font-mono text-sm tracking-wide text-foreground">
          Platform map
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Swim sheet for stack, schedule, vendors, UI, and monitoring. Canonical
          deep dives stay in ARCHITECTURE / FETCH-ORDER / DEPLOYMENT.
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {PLATFORM_MAP.map((section) => (
            <div key={section.title}>
              <h3 className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                {section.title}
              </h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--desk-text-secondary)]">
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
