"use client";

import { useEffect, useState } from "react";
import { BookOpen, XIcon } from "lucide-react";

import { AiAnalysisPanel } from "@/components/ai-analysis-panel";
import { CategoryBadge } from "@/components/category-badge";
import { EdgarProofLink } from "@/components/edgar-proof-link";
import { TradingViewAdvancedChart } from "@/components/tradingview-advanced-chart";
import { Button } from "@/components/ui/button";
import type { FeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import type {
  ArticleCompanyProfile,
  ArticleMarketQuote,
} from "@/lib/catalysts/enrich-article";
import { toTradingViewSymbol } from "@/lib/catalysts/enrich-article-format";
import { sectorLabel, titleLine } from "@/lib/catalysts/feed-display";
import { formatEventTime, formatRelativeAge } from "@/lib/format/relative-time";
import { CATEGORY_LABELS } from "@/lib/jobs/parse-8k-items";
import type { TriageResult } from "@/lib/jobs/llm-triage";
import {
  DEFAULT_CHART_RANGE,
  chartRangeDef,
  type ChartRangeKey,
} from "@/lib/market/chart-range";
import { cn } from "@/lib/utils";

type QuotePayload = {
  ticker: string;
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
): { text: string; up: boolean | null } {
  if (change == null || pct == null) return { text: "—", up: null };
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
 * Right-hand Live tape triage panel: identity, short summary / AI, then chart.
 * Full filing body / takeaways live in the article modal (`onRead`).
 */
export function TapeSplitPanel({
  catalyst,
  onClose,
  onRead,
  onDismiss,
  onAiAnalyzed,
  className,
  mobileOverlay = false,
}: {
  catalyst: FeedCatalyst;
  onClose: () => void;
  onRead?: () => void;
  onDismiss?: () => void;
  /** Persist AI triage into the Live tape row so reopen stays instant. */
  onAiAnalyzed?: (analysis: TriageResult) => void;
  /**
   * Kept for call-site compatibility. Outbound vendor proof links are gated
   * inside `EdgarProofLink` (local-dev only).
   */
  isAdmin?: boolean;
  className?: string;
  /** Full-screen overlay on small viewports. */
  mobileOverlay?: boolean;
}) {
  const ticker = catalyst.ticker?.trim().toUpperCase() || null;
  const [market, setMarket] = useState<QuotePayload | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(Boolean(ticker));
  const [chartRange, setChartRange] =
    useState<ChartRangeKey>(DEFAULT_CHART_RANGE);
  const [rangePerf, setRangePerf] = useState<{
    change: number | null;
    changePercent: number | null;
    price: number | null;
  } | null>(null);
  const [rangePerfLoading, setRangePerfLoading] = useState(false);

  const eventTitle = titleLine(catalyst);
  const categoryLabel = catalyst.eventCategory
    ? CATEGORY_LABELS[catalyst.eventCategory]
    : null;
  const subcategory = catalyst.subcategory?.replace(/_/g, " ") || null;
  const summaryText =
    catalyst.summary?.trim() ||
    catalyst.headline?.trim() ||
    catalyst.title.trim();
  const companyName =
    market?.profile?.name?.trim() || catalyst.companyName?.trim() || null;

  const eyebrow = [categoryLabel, catalyst.type?.trim() || null]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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
  }, [onClose, mobileOverlay]);

  useEffect(() => {
    if (!ticker) return;

    let cancelled = false;
    setChartRange(DEFAULT_CHART_RANGE);
    setRangePerf(null);
    const id = window.setTimeout(() => {
      void (async () => {
        setQuoteLoading(true);
        try {
          const res = await fetch(
            `/api/market/quote?symbol=${encodeURIComponent(ticker)}`,
            { credentials: "same-origin" },
          );
          if (!res.ok) throw new Error("quote failed");
          const data = (await res.json()) as QuotePayload;
          if (!cancelled) setMarket(data);
        } catch {
          if (!cancelled) {
            setMarket({
              ticker,
              tradingViewSymbol: toTradingViewSymbol(ticker, null),
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
  }, [ticker]);

  useEffect(() => {
    if (!ticker || chartRange === "1D") {
      setRangePerf(null);
      setRangePerfLoading(false);
      return;
    }

    let cancelled = false;
    setRangePerfLoading(true);
    const id = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/market/performance?symbol=${encodeURIComponent(ticker)}&range=${encodeURIComponent(chartRange)}`,
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
  }, [ticker, chartRange]);

  const tvSymbol =
    market?.tradingViewSymbol ??
    (ticker ? toTradingViewSymbol(ticker, null) : null);

  const useRangeMove = chartRange !== "1D";
  const displayPrice = useRangeMove
    ? (rangePerf?.price ?? market?.quote?.price)
    : market?.quote?.price;
  const change = formatChange(
    useRangeMove ? rangePerf?.change : market?.quote?.change,
    useRangeMove ? rangePerf?.changePercent : market?.quote?.changePercent,
  );
  const changeLabel = chartRangeDef(chartRange).label;

  return (
    <aside
      role="dialog"
      aria-modal={mobileOverlay}
      aria-labelledby={`tape-split-${catalyst.id}`}
      className={cn(
        "flex min-h-0 flex-col border-[var(--desk-border)] bg-[var(--desk-panel)]",
        mobileOverlay &&
          "shadow-[-12px_0_40px_rgba(0,0,0,0.55)] lg:shadow-none",
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
            className="mt-1 line-clamp-3 text-base font-semibold tracking-tight text-[var(--desk-text)] sm:text-lg"
          >
            {eventTitle}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {ticker ? (
              <span className="font-mono text-sm font-semibold tracking-wide text-[var(--desk-text)]">
                {ticker}
              </span>
            ) : (
              <span className="rounded-sm border border-[var(--desk-warn-border)] bg-[var(--desk-warn-bg)] px-1.5 py-0.5 font-mono text-[0.65rem] tracking-wide text-[var(--desk-warn-text)] uppercase">
                Ticker unresolved
              </span>
            )}
            {companyName ? (
              <span className="truncate text-sm text-[var(--desk-text-muted)]">
                {companyName}
              </span>
            ) : null}
            {catalyst.eventCategory ? (
              <CategoryBadge category={catalyst.eventCategory} />
            ) : null}
          </div>

          {ticker ? (
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
                      change.up === true && "text-emerald-400",
                      change.up === false && "text-rose-400",
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
                        <span className="ml-1.5 text-[0.7rem] tracking-wide text-[var(--desk-text-dim)] uppercase">
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
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="btn-press shrink-0 text-[var(--desk-text-muted)] hover:text-[var(--desk-text)]"
          onClick={onClose}
        >
          <XIcon />
          <span className="sr-only">Close</span>
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex flex-col gap-4 border-b border-[var(--desk-border)] px-4 py-4">
          {!ticker ? (
            <div className="rounded-sm border border-[var(--desk-border)] bg-[var(--desk-overlay-soft)] px-3 py-3">
              <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                Filing context
              </p>
              <p className="mt-1.5 text-sm leading-snug text-[var(--desk-text-secondary)]">
                No tradable ticker resolved for this row — chart and quote are
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
              className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--desk-live)] px-3 py-1.5 font-mono text-xs font-semibold tracking-wide text-[#121212] uppercase hover:brightness-110"
            >
              <BookOpen className="size-3.5" />
              Full article
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

          <div>
            <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
              Triage summary
            </p>
            <p className="mt-2 line-clamp-5 text-sm leading-relaxed text-[var(--desk-text-secondary)]">
              {summaryText}
            </p>
            <p className="mt-2 font-mono text-[0.62rem] tracking-wide text-[var(--desk-text-dim)]">
              Open Full article for body, takeaways, and filing detail.
            </p>
          </div>

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

          <dl className="grid grid-cols-2 gap-3 font-mono text-xs">
            <MetaCell
              label="Category"
              value={
                [categoryLabel, subcategory].filter(Boolean).join(" · ") || "—"
              }
            />
            <MetaCell label="Form" value={catalyst.type || "—"} />
            <MetaCell label="Sector" value={sectorLabel(catalyst)} />
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
            {typeof catalyst.impactScore === "number" ? (
              <MetaCell
                label="Impact"
                value={String(catalyst.impactScore)}
                tabular
              />
            ) : null}
          </dl>
        </div>

        {tvSymbol ? (
          <div className="shrink-0 bg-[#0b0d10]">
            <TradingViewAdvancedChart
              key={tvSymbol}
              symbol={tvSymbol}
              range={chartRange}
              onRangeChange={setChartRange}
              className="h-[300px] sm:h-[360px]"
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
