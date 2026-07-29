import { Play, Volume2 } from "lucide-react";

/**
 * "LIVE SQUAWK" panel — the reference image's top-left audio player.
 *
 * PLACEHOLDER, not functional: a live audio squawk feed (real-time
 * text-to-speech or a broadcast audio stream tied to tape events) is a
 * disproportionately large new subsystem (audio pipeline, streaming infra,
 * script generation from catalysts) relative to the rest of this visual
 * redesign, and no such feature exists anywhere in the codebase today
 * (confirmed during research). This ships a clearly-labeled, honestly
 * disabled "Coming soon" panel matching the reference's layout/position
 * instead of faking a working player.
 */
export function DashboardSquawkPanel() {
  return (
    <section
      aria-label="Live squawk (coming soon)"
      className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--desk-border)] bg-[var(--desk-panel)]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--desk-border)] bg-[var(--desk-header)] px-3 py-2.5">
        <h2 className="flex items-center gap-1.5 font-mono text-[0.7rem] font-semibold tracking-[0.14em] text-[var(--desk-text)] uppercase">
          <span className="size-1.5 rounded-full bg-[var(--desk-text-dim)]" />
          Live Squawk
        </h2>
        <span className="rounded border border-[var(--desk-border-strong)] px-1.5 py-0.5 font-mono text-[0.58rem] tracking-wide text-[var(--desk-text-dim)] uppercase">
          Coming soon
        </span>
      </div>
      <div className="flex items-center gap-2.5 px-3 py-3 opacity-60">
        <button
          type="button"
          disabled
          aria-label="Play (not yet available)"
          className="grid size-8 shrink-0 cursor-not-allowed place-items-center rounded-full bg-[var(--desk-live)] text-[#121212]"
        >
          <Play className="size-3.5 fill-current" />
        </button>
        <div className="h-1 flex-1 rounded-full bg-[var(--desk-border-strong)]" />
        <span className="font-mono text-[0.65rem] text-[var(--desk-text-dim)] tabular-nums">
          00:00
        </span>
        <Volume2 className="size-3.5 shrink-0 text-[var(--desk-text-dim)]" />
      </div>
      <p className="border-t border-[var(--desk-border)] px-3 py-2 text-[0.7rem] leading-snug text-[var(--desk-text-dim)]">
        Live audio squawk (spoken catalyst alerts) is planned but not built yet
        — this panel is a placeholder.
      </p>
    </section>
  );
}
