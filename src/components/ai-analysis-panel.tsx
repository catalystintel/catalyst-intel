"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import type { AiLean } from "@/db/schema";
import type { TriageResult } from "@/lib/jobs/llm-triage";
import { cn } from "@/lib/utils";

type PanelState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; analysis: TriageResult }
  | { kind: "error"; message: string };

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

function AnalysisBody({ analysis }: { analysis: TriageResult }) {
  return (
    <div className="ai-analysis-reveal flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
          AI analysis
        </p>
        <span
          className={cn(
            "font-mono text-[0.65rem] tracking-wide uppercase",
            LEAN_CLASS[analysis.lean],
          )}
        >
          {LEAN_LABEL[analysis.lean]}
          {analysis.uncertain ? " · low confidence" : ""}
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
        Grounded in the filing text only — not a prediction. Shared for every
        viewer once computed.
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
          kind: "error",
          message:
            data.error ??
            "AI analysis unavailable right now. Try again in a minute.",
        });
        return;
      }
      setState({ kind: "ready", analysis: data.analysis });
      onAnalyzed?.(data.analysis);
    } catch {
      setState({
        kind: "error",
        message: "Network error while analyzing. Try again shortly.",
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
          "pointer-events-none px-3 py-3 blur-[5px] select-none",
          state.kind === "loading" && "ai-analysis-pulse opacity-70",
        )}
        aria-hidden
      >
        <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
          AI analysis
        </p>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-[var(--desk-text-secondary)]">
          <li>Restates the key facts from the filing…</li>
          <li>Flags the directional lean when the text supports it…</li>
          <li>Stays short — no speculation or price targets…</li>
        </ul>
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[color-mix(in_srgb,var(--desk-panel)_55%,transparent)] px-4 text-center backdrop-blur-[1px]">
        {state.kind === "loading" ? (
          <>
            <Loader2
              className="ai-analysis-spinner size-5 text-[var(--desk-live)]"
              aria-hidden
            />
            <p className="font-mono text-xs tracking-wide text-[var(--desk-text)] uppercase">
              Analyzing…
            </p>
            <p className="max-w-[16rem] font-mono text-[0.65rem] leading-snug text-[var(--desk-text-dim)]">
              Reading the filing and writing a short grounded triage.
            </p>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void runAnalyze()}
              className="btn-press inline-flex items-center gap-1.5 rounded-sm bg-[var(--desk-live)] px-3 py-1.5 font-mono text-xs font-semibold tracking-wide text-[#121212] uppercase hover:brightness-110"
            >
              <Sparkles className="size-3.5" aria-hidden />
              See AI analysis
            </button>
            {state.kind === "error" ? (
              <p
                role="alert"
                className="max-w-[18rem] font-mono text-[0.65rem] leading-snug text-rose-400"
              >
                {state.message}
              </p>
            ) : (
              <p className="max-w-[16rem] font-mono text-[0.65rem] leading-snug text-[var(--desk-text-dim)]">
                One-time compute — then visible to everyone on this event.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
