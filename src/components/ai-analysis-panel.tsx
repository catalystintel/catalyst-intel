"use client";

import { useState } from "react";
import { Info, Sparkles } from "lucide-react";

import { DeskTip } from "@/components/desk-tip";
import { Skeleton } from "@/components/loading-skeleton";
import type { AiLean } from "@/db/schema";
import type { TriageResult } from "@/lib/jobs/llm-triage";
import { cn } from "@/lib/utils";

type PanelState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; analysis: TriageResult }
  | { kind: "unavailable"; message: string };

const LEAN_LABEL: Record<AiLean, string> = {
  bullish: "Bullish lean",
  bearish: "Bearish lean",
  neutral: "Neutral lean",
  uncertain: "Uncertain",
};

const LEAN_CLASS: Record<AiLean, string> = {
  bullish: "text-emerald-400",
  bearish: "text-rose-400",
  neutral: "text-[var(--desk-text-secondary)]",
  uncertain: "text-[var(--desk-text-dim)]",
};

const AI_INFO_TIP =
  "Short plain-English triage grounded in this event’s stored filing text and key facts. Shared for every viewer once computed. Not a prediction or buy/sell advice.";

function AnalysisBody({ analysis }: { analysis: TriageResult }) {
  return (
    <div className="ai-analysis-reveal flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
          AI analysis
          <DeskTip content={AI_INFO_TIP} side="bottom">
            <span
              className="inline-flex size-3.5 items-center justify-center rounded-full border border-[var(--desk-border-strong)] text-[var(--desk-text-dim)] hover:text-[var(--desk-text)]"
              aria-label="About AI analysis"
            >
              <Info className="size-2.5" aria-hidden />
            </span>
          </DeskTip>
        </p>
        <span
          className={cn(
            "font-mono text-[0.65rem] tracking-wide uppercase",
            LEAN_CLASS[analysis.lean],
          )}
        >
          {LEAN_LABEL[analysis.lean]}
          {analysis.uncertain ? " · thin filing" : ""}
        </span>
      </div>
      <ul className="flex list-none flex-col gap-1.5 pl-0">
        {analysis.bullets.map((bullet, i) => (
          <li
            key={`ai-bullet-${i}`}
            className="flex gap-2 text-sm leading-relaxed text-[var(--desk-text-secondary)]"
            style={{ animationDelay: `${80 + i * 70}ms` }}
          >
            <span
              className="mt-2 size-1 shrink-0 rounded-full bg-[var(--desk-live)]"
              aria-hidden
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      <p className="font-mono text-[0.6rem] leading-snug tracking-wide text-[var(--desk-text-dim)]">
        Grounded in the filing text only — not a prediction.
      </p>
    </div>
  );
}

/**
 * Blurred teaser → Analyze → persisted triage. Never offers re-analyze.
 */
export function AiAnalysisPanel({
  catalystId,
  initial,
  onAnalyzed,
  className,
}: {
  catalystId: number;
  initial: TriageResult | null;
  onAnalyzed?: (analysis: TriageResult) => void;
  className?: string;
}) {
  const [state, setState] = useState<PanelState>(() =>
    initial ? { kind: "ready", analysis: initial } : { kind: "idle" },
  );

  async function runAnalyze() {
    if (state.kind === "loading" || state.kind === "ready") return;
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/catalysts/${catalystId}/analyze`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        analysis?: TriageResult;
        error?: string;
      };
      if (!res.ok || !data.analysis) {
        setState({
          kind: "unavailable",
          message:
            "AI analysis is not available at the moment. You can try again shortly.",
        });
        return;
      }
      setState({ kind: "ready", analysis: data.analysis });
      onAnalyzed?.(data.analysis);
    } catch {
      setState({
        kind: "unavailable",
        message:
          "AI analysis is not available at the moment. You can try again shortly.",
      });
    }
  }

  if (state.kind === "ready") {
    return (
      <section
        className={cn(
          "rounded-sm border border-[var(--desk-border)] bg-[var(--desk-overlay-soft)] px-3 py-3",
          className,
        )}
      >
        <AnalysisBody analysis={state.analysis} />
      </section>
    );
  }

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-sm border border-[var(--desk-border)] bg-[var(--desk-overlay-soft)]",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none px-3 py-3 select-none",
          state.kind === "loading" ? "" : "blur-[5px]",
        )}
        aria-hidden
      >
        {state.kind === "loading" ? (
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-2 w-20" />
            <div className="mt-1 flex flex-col gap-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-[82%]" />
              <Skeleton className="h-3 w-[58%]" />
            </div>
          </div>
        ) : (
          <>
            <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
              AI analysis
            </p>
            <ul className="mt-2 flex flex-col gap-1.5 text-sm text-[var(--desk-text-secondary)]">
              <li>Restates the key facts from the filing…</li>
              <li>Flags the directional lean when the text supports it…</li>
              <li>Stays short — no speculation or price targets…</li>
            </ul>
          </>
        )}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden bg-[color-mix(in_srgb,var(--desk-panel)_55%,transparent)] px-4 text-center backdrop-blur-[1px]">
        {state.kind === "loading" ? (
          <>
            <span
              aria-hidden
              className="ai-scanline pointer-events-none absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-[var(--desk-live)]/[0.12] to-transparent"
            />
            <div
              role="status"
              aria-live="polite"
              className="relative flex flex-col items-center gap-2"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--desk-live)]/35 bg-[var(--desk-live)]/10 px-2.5 py-1 font-mono text-[0.65rem] font-semibold tracking-[0.14em] text-[var(--desk-live)] uppercase">
                <span
                  className="live-pulse size-1.5 shrink-0 rounded-full bg-[var(--desk-live)]"
                  aria-hidden
                />
                Analyzing
                <span className="ai-analyzing-dots inline-flex" aria-hidden>
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </span>
              <p className="max-w-[16rem] font-mono text-[0.65rem] leading-snug text-[var(--desk-text-dim)]">
                Reading the filing text and writing a short plain-English
                triage.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="relative flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void runAnalyze()}
                className="btn-press inline-flex items-center gap-1.5 rounded-sm bg-[var(--desk-live)] px-3 py-1.5 font-mono text-xs font-semibold tracking-wide text-[#121212] uppercase hover:brightness-110"
              >
                <Sparkles className="size-3.5" aria-hidden />
                See AI analysis
              </button>
              <DeskTip content={AI_INFO_TIP} side="bottom">
                <button
                  type="button"
                  className="inline-flex size-6 items-center justify-center rounded-sm border border-[var(--desk-border-strong)] text-[var(--desk-text-dim)] hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
                  aria-label="About AI analysis"
                >
                  <Info className="size-3.5" aria-hidden />
                </button>
              </DeskTip>
            </div>
            {state.kind === "unavailable" ? (
              <p
                role="status"
                className="max-w-[18rem] font-mono text-[0.65rem] leading-snug text-[var(--desk-text-muted)]"
              >
                {state.message}
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
