"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, ChevronDown, ChevronUp, XIcon } from "lucide-react";

import { AiAnalysisPanel } from "@/components/ai-analysis-panel";
import { CategoryBadge } from "@/components/category-badge";
import { EdgarProofLink } from "@/components/edgar-proof-link";
import { Button } from "@/components/ui/button";
import {
  isAccNoMetadataBlob,
  isWeakSummary,
} from "@/lib/catalysts/article-content";
import { deriveWhyMoving } from "@/lib/catalysts/article-funnel";
import { deriveSubjectTakeaways } from "@/lib/catalysts/subject-article-content";
import type { FeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import type {
  ArticleCompanyProfile,
  ArticleMarketQuote,
} from "@/lib/catalysts/enrich-article";
import { toTradingViewSymbol } from "@/lib/catalysts/enrich-article-format";
import {
  sectorLabel,
  sourceDisplay,
  titleLine,
} from "@/lib/catalysts/feed-display";
import { plainEnglishForSecForm } from "@/lib/catalysts/sec-form-plain-english";
import {
  articleCategoryLabel,
  showArticleCategoryBadge,
} from "@/lib/catalysts/taxonomy";
import { formatEventTime, formatRelativeAge } from "@/lib/format/relative-time";
import type { TriageResult } from "@/lib/jobs/llm-triage";
import { chartRangeDef, type ChartRangeKey } from "@/lib/market/chart-range";
import { cn } from "@/lib/utils";

type QuotePayload = {
  symbol: string;
  tradingViewSymbol: string;
  quote: ArticleMarketQuote | null;
  profile: ArticleCompanyProfile | null;
};

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatChange(
  change: number | null | undefined,
  pct: number | null | undefined,
  opts?: { maxAbsPct?: number },
): { text: string; up: boolean | null } {
  if (change == null || pct == null) return { text: "—", up: null };
  const maxAbs = opts?.maxAbsPct;
  if (maxAbs != null && Math.abs(pct) > maxAbs) {
    return { text: "—", up: null };
  }
  const sign = change > 0 ? "+" : "";
  return {
    text: `${sign}${change.toFixed(2)} (${sign}${pct.toFixed(2)}%)`,
    up: change === 0 ? null : change > 0,
  };
}

function MetaCell({
  label,
  value,
  tabular = false,
  className,
}: {
  label: string;
  value: string;
  tabular?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 text-sm text-[var(--desk-text)]",
          tabular && "tabular-nums",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Right-hand Live tape triage panel: identity, short summary / AI.
 * Chart lives in a sibling pane (`TapeChartPanel`); pass `chartSlot` on
 * narrow viewports to pin it under the header. Fuller event text lives in
 * the details view (`onRead`).
 */
export function TapeSplitPanel({
  catalyst,
  onClose,
  onPrev,
  onNext,
  canPrev = false,
  canNext = false,
  onRead,
  onDismiss,
  onAiAnalyzed,
  className,
  mobileOverlay = false,
  showSourceLabels = false,
  chartRange,
  chartSlot = null,
}: {
  catalyst: FeedCatalyst;
  onClose: () => void;
  /** Move to the previous (newer) tape row without closing the split. */
  onPrev?: () => void;
  /** Move to the next (older) tape row without closing the split. */
  onNext?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  onRead?: () => void;
  onDismiss?: () => void;
  /** Persist AI triage into the Live tape row so reopen stays instant. */
  onAiAnalyzed?: (analysis: TriageResult) => void;
  /**
   * Kept for call-site compatibility. Outbound vendor proof links are gated
   * inside `EdgarProofLink` (local-dev only).
   */
  isAdmin?: boolean;
  /** When true, show vendor source in the meta grid. */
  showSourceLabels?: boolean;
  className?: string;
  /** Full-screen overlay on small viewports. */
  mobileOverlay?: boolean;
  /** Shared lookback with the sibling chart pane (drives quote Δ label). */
  chartRange: ChartRangeKey;
  /** Optional chart pinned under the header (mobile overlay). */
  chartSlot?: ReactNode;
}) {
  const symbol = catalyst.symbol?.trim().toUpperCase() || null;
  const [market, setMarket] = useState<QuotePayload | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(Boolean(symbol));
  const [rangePerf, setRangePerf] = useState<{
    change: number | null;
    changePercent: number | null;
    price: number | null;
  } | null>(null);
  const [rangePerfLoading, setRangePerfLoading] = useState(false);

  const eventTitle = titleLine(catalyst);
  const categoryLabel = articleCategoryLabel(catalyst.eventCategory);
  const subcategory = catalyst.subcategory?.replace(/_/g, " ") || null;
  const rawSummary = catalyst.summary?.trim() || "";
  const summaryText =
    (rawSummary &&
    !isAccNoMetadataBlob(rawSummary) &&
    !isWeakSummary(rawSummary)
      ? rawSummary
      : null) ||
    catalyst.headline?.trim() ||
    catalyst.title.trim();
  const formBlurb = plainEnglishForSecForm(catalyst.type);
  const subjectLines = deriveSubjectTakeaways({
    eventCategory: catalyst.eventCategory,
    summary: rawSummary && !isAccNoMetadataBlob(rawSummary) ? rawSummary : null,
    headline: catalyst.headline,
    title: catalyst.title,
    keyFacts: catalyst.keyFacts,
    companyName: catalyst.companyName,
    symbol: catalyst.symbol,
    maxLines: 6,
  }).filter((t) => !isAccNoMetadataBlob(t));
  const whyMoving =
    deriveWhyMoving({
      summary:
        rawSummary && !isAccNoMetadataBlob(rawSummary) ? rawSummary : null,
      headline: catalyst.headline,
      title: catalyst.title,
    }) ||
    subjectLines[0] ||
    null;
  // Keep takeaways to ~3–6 total desk lines; drop the why-line when duplicated.
  const takeaways = subjectLines
    .filter(
      (line) => !whyMoving || line.toLowerCase() !== whyMoving.toLowerCase(),
    )
    .slice(0, 5);
  const companyName =
    market?.profile?.name?.trim() || catalyst.companyName?.trim() || null;

  const eyebrow = [categoryLabel, catalyst.type?.trim() || null]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      if (e.key === "ArrowUp" && canPrev) {
        e.preventDefault();
        onPrev?.();
        return;
      }
      if (e.key === "ArrowDown" && canNext) {
        e.preventDefault();
        onNext?.();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    if (mobileOverlay && typeof window !== "undefined") {
      const mq = window.matchMedia("(max-width: 1023px)");
      if (mq.matches) document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, onPrev, onNext, canPrev, canNext, mobileOverlay]);

  useEffect(() => {
    if (!symbol) return;

    let cancelled = false;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      setRangePerf(null);
      setQuoteLoading(true);
      void (async () => {
        try {
          const res = await fetch(
            `/api/market/quote?symbol=${encodeURIComponent(symbol)}`,
            { credentials: "same-origin" },
          );
          if (!res.ok) throw new Error("quote failed");
          const data = (await res.json()) as QuotePayload;
          if (!cancelled) setMarket(data);
        } catch {
          if (!cancelled) {
            setMarket({
              symbol,
              tradingViewSymbol: toTradingViewSymbol(symbol, null),
              quote: null,
              profile: null,
            });
          }
        } finally {
          if (!cancelled) setQuoteLoading(false);
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [symbol]);

  useEffect(() => {
    // 1D uses the session quote — ignore cached multi-day performance.
    if (!symbol || chartRange === "1D") return;

    let cancelled = false;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      setRangePerfLoading(true);
      void (async () => {
        try {
          const res = await fetch(
            `/api/market/performance?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(chartRange)}`,
            { credentials: "same-origin" },
          );
          if (!res.ok) throw new Error("performance failed");
          const data = (await res.json()) as {
            change: number | null;
            changePercent: number | null;
            price: number | null;
          };
          if (!cancelled) {
            setRangePerf({
              change: data.change,
              changePercent: data.changePercent,
              price: data.price,
            });
          }
        } catch {
          if (!cancelled) setRangePerf(null);
        } finally {
          if (!cancelled) setRangePerfLoading(false);
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [symbol, chartRange]);

  const useRangeMove = chartRange !== "1D";
  const displayPrice = useRangeMove
    ? (rangePerf?.price ?? market?.quote?.price)
    : market?.quote?.price;
  const change = formatChange(
    useRangeMove ? rangePerf?.change : market?.quote?.change,
    useRangeMove ? rangePerf?.changePercent : market?.quote?.changePercent,
    // Session (1D) moves of hundreds of % are almost always bad vendor data.
    useRangeMove ? undefined : { maxAbsPct: 200 },
  );
  const changeLabel = chartRangeDef(chartRange).label;

  return (
    <aside
      role="dialog"
      aria-modal={mobileOverlay}
      aria-labelledby={`tape-split-${catalyst.id}`}
      className={cn(
        "desk-arial flex min-h-0 flex-col border-[var(--desk-border)]",
        // Overlay must be opaque so feed text doesn't show through the glass panel.
        mobileOverlay ? "bg-popover" : "bg-[var(--desk-panel)]",
        mobileOverlay &&
          "shadow-[-12px_0_40px_var(--desk-panel-shadow)] xl:shadow-none",
        className,
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--desk-border)] bg-[var(--desk-header)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-live)] uppercase">
            {eyebrow || "Catalyst"}
          </p>
          <h2
            id={`tape-split-${catalyst.id}`}
            className="mt-1 line-clamp-2 text-base font-semibold tracking-tight text-[var(--desk-text)] sm:text-lg"
          >
            {eventTitle}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {symbol ? (
              <span className="font-mono text-sm font-semibold tracking-wide text-[var(--desk-text)]">
                {symbol}
              </span>
            ) : (
              <span className="rounded-sm border border-[var(--desk-warn-border)] bg-[var(--desk-warn-bg)] px-1.5 py-0.5 font-mono text-[0.65rem] tracking-wide text-[var(--desk-warn-text)] uppercase">
                Symbol unresolved
              </span>
            )}
            {companyName ? (
              <span className="truncate text-sm text-[var(--desk-text-muted)]">
                {companyName}
              </span>
            ) : null}
            {showArticleCategoryBadge(catalyst.eventCategory) ? (
              <CategoryBadge category={catalyst.eventCategory} />
            ) : null}
          </div>

          {symbol ? (
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-sm tabular-nums">
              {quoteLoading && !market?.quote ? (
                <span className="text-[var(--desk-text-dim)]">Loading…</span>
              ) : (
                <>
                  <span className="text-lg font-semibold text-[var(--desk-text)]">
                    {formatPrice(displayPrice)}
                  </span>
                  <span
                    className={cn(
                      change.up === true && "text-[var(--desk-positive)]",
                      change.up === false && "text-[var(--desk-negative)]",
                      change.up == null && "text-[var(--desk-text-muted)]",
                    )}
                    title={
                      useRangeMove
                        ? `Change over ${changeLabel} lookback`
                        : "Session change"
                    }
                  >
                    {rangePerfLoading && useRangeMove ? (
                      <span className="text-[var(--desk-text-dim)]">…</span>
                    ) : (
                      <>
                        {change.text}
                        <span className="ml-1.5 text-[0.7rem] tracking-wide text-[var(--desk-text-dim)]">
                          {changeLabel}
                        </span>
                      </>
                    )}
                  </span>
                </>
              )}
            </div>
          ) : null}
          {market?.quote ? (
            <dl className="mt-2 grid grid-cols-3 gap-2 font-mono text-[0.7rem] text-[var(--desk-text-dim)]">
              <div>
                <dt className="tracking-wider uppercase">Open</dt>
                <dd className="text-[var(--desk-text-secondary)] tabular-nums">
                  {formatPrice(market.quote.open)}
                </dd>
              </div>
              <div>
                <dt className="tracking-wider uppercase">High</dt>
                <dd className="text-[var(--desk-text-secondary)] tabular-nums">
                  {formatPrice(market.quote.high)}
                </dd>
              </div>
              <div>
                <dt className="tracking-wider uppercase">Low</dt>
                <dd className="text-[var(--desk-text-secondary)] tabular-nums">
                  {formatPrice(market.quote.low)}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={!canPrev}
            title={canPrev ? "Newer catalyst" : "Already at newest"}
            className="btn-press text-[var(--desk-text-muted)] hover:text-[var(--desk-text)] disabled:pointer-events-none disabled:opacity-30"
            onClick={canPrev ? onPrev : undefined}
            aria-keyshortcuts="ArrowUp"
          >
            <ChevronUp />
            <span className="sr-only">
              {canPrev ? "Previous catalyst" : "Already at newest catalyst"}
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={!canNext}
            title={canNext ? "Older catalyst" : "Already at oldest loaded"}
            className="btn-press text-[var(--desk-text-muted)] hover:text-[var(--desk-text)] disabled:pointer-events-none disabled:opacity-30"
            onClick={canNext ? onNext : undefined}
            aria-keyshortcuts="ArrowDown"
          >
            <ChevronDown />
            <span className="sr-only">
              {canNext ? "Next catalyst" : "Already at oldest loaded catalyst"}
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="btn-press text-[var(--desk-text-muted)] hover:text-[var(--desk-text)]"
            onClick={onClose}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </div>

      {chartSlot}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex flex-col gap-5 border-b border-[var(--desk-border)] px-4 py-5">
          {!symbol ? (
            <div className="rounded-sm border border-[var(--desk-border)] bg-[var(--desk-overlay-soft)] px-3 py-3">
              <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                Filing context
              </p>
              <p className="mt-1.5 text-sm leading-snug text-[var(--desk-text-secondary)]">
                No tradable symbol resolved for this row — chart and quote are
                skipped. Review the filing summary below.
              </p>
              <p className="mt-2 font-mono text-[0.7rem] tracking-wide text-[var(--desk-text-dim)]">
                {[catalyst.type, subcategory].filter(Boolean).join(" · ")}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onRead?.()}
              className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--desk-live)] px-3 py-1.5 font-mono text-xs font-semibold tracking-wide text-[var(--desk-accent-fg)] uppercase hover:brightness-110"
            >
              <BookOpen className="size-3.5" />
              Details
            </button>
            <EdgarProofLink
              url={catalyst.sourceUrl}
              provider={catalyst.sourceProvider}
              className="rounded-sm px-3 py-1.5 text-xs tracking-wide uppercase"
            />
            <button
              type="button"
              onClick={() => onDismiss?.()}
              className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--desk-border-strong)] px-3 py-1.5 font-mono text-xs tracking-wide text-[var(--desk-text-muted)] uppercase hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
            >
              Dismiss
            </button>
          </div>

          {whyMoving ? (
            <div
              className="border-l-2 border-[var(--desk-live)] pl-3"
              role="note"
              aria-label="Why it's moving"
            >
              <p className="font-mono text-[0.62rem] tracking-[0.14em] text-[var(--desk-live)] uppercase">
                Why it&apos;s moving
              </p>
              <p className="mt-1.5 text-sm leading-snug text-[var(--desk-text)]">
                {whyMoving}
              </p>
            </div>
          ) : null}

          {takeaways.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                Takeaways
              </h3>
              <ul className="flex list-none flex-col gap-2 pl-0">
                {takeaways.map((bullet, i) => (
                  <li
                    key={`takeaway-${i}`}
                    className="flex gap-2.5 text-sm leading-relaxed text-[var(--desk-text-secondary)]"
                  >
                    <span
                      className="mt-2 size-1 shrink-0 rounded-full bg-[var(--desk-live)]"
                      aria-hidden
                    />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="flex flex-col gap-2">
              <h3 className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                Summary
              </h3>
              <p className="line-clamp-4 text-sm leading-relaxed text-[var(--desk-text-secondary)]">
                {summaryText}
              </p>
              {formBlurb ? (
                <p className="text-[0.8rem] leading-snug text-[var(--desk-text-muted)]">
                  {formBlurb}
                </p>
              ) : null}
            </section>
          )}

          {catalyst.keyFacts.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                Key facts
              </h3>
              <dl className="grid grid-cols-2 gap-2">
                {catalyst.keyFacts.slice(0, 6).map((fact) => (
                  <div
                    key={`${fact.label}:${fact.value}`}
                    className="border-b border-[var(--desk-border)] px-0.5 py-2"
                  >
                    <dt className="font-mono text-[0.6rem] tracking-[0.12em] text-[var(--desk-text-dim)] uppercase">
                      {fact.label}
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium text-[var(--desk-text)]">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : catalyst.items.length > 0 ? (
            <section className="flex flex-col gap-1.5">
              <h3 className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                Filing items
              </h3>
              <ul className="space-y-1">
                {catalyst.items.slice(0, 4).map((item) => (
                  <li
                    key={item.code}
                    className="font-mono text-[0.7rem] text-[var(--desk-text-muted)]"
                  >
                    <span className="text-[var(--desk-text-secondary)]">
                      Item {item.code}
                    </span>
                    {item.label ? ` · ${item.label}` : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {takeaways.length > 0 && formBlurb ? (
            <p className="text-[0.8rem] leading-snug text-[var(--desk-text-muted)]">
              {formBlurb}
            </p>
          ) : null}

          <AiAnalysisPanel
            key={`ai-${catalyst.id}`}
            catalystId={catalyst.id}
            initial={
              catalyst.aiBullets
                ? {
                    bullets: catalyst.aiBullets,
                    lean: catalyst.aiLean ?? "uncertain",
                    uncertain: catalyst.aiUncertain ?? true,
                  }
                : null
            }
            onAnalyzed={onAiAnalyzed}
          />

          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-[var(--desk-border)] pt-4 font-mono text-xs">
            <MetaCell
              label="Category"
              value={
                [categoryLabel, subcategory].filter(Boolean).join(" · ") || "—"
              }
            />
            <MetaCell label="Form" value={catalyst.type || "—"} />
            <MetaCell
              label="Sector"
              value={sectorLabel(catalyst, {
                omitArticleSuppressedCategories: true,
              })}
            />
            {showSourceLabels ? (
              <MetaCell label="Source" value={sourceDisplay(catalyst).name} />
            ) : null}
            <MetaCell
              label="Age"
              value={formatRelativeAge(catalyst.timestamp)}
              tabular
            />
            <MetaCell
              label="Event time"
              value={formatEventTime(catalyst.timestamp)}
              tabular
            />
          </dl>
        </div>
      </div>
    </aside>
  );
}
