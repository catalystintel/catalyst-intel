"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, XIcon } from "lucide-react";

import { CategoryBadge } from "@/components/category-badge";
import { EdgarProofLink } from "@/components/edgar-proof-link";
import { MaterialityBadge } from "@/components/materiality-badge";
import { TradingViewAdvancedChart } from "@/components/tradingview-advanced-chart";
import { Button } from "@/components/ui/button";
import type { FeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import type {
  ArticleCompanyProfile,
  ArticleMarketQuote,
} from "@/lib/catalysts/enrich-article";
import { toTradingViewSymbol } from "@/lib/catalysts/enrich-article-format";
import { formatEventTime, formatRelativeAge } from "@/lib/format/relative-time";
import { CATEGORY_LABELS } from "@/lib/jobs/parse-8k-items";
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

/**
 * Right-hand Live tape panel: quote strip, TradingView chart, catalyst details.
 */
export function TapeSplitPanel({
  catalyst,
  onClose,
  onDismiss,
  className,
  mobileOverlay = false,
}: {
  catalyst: FeedCatalyst;
  onClose: () => void;
  onDismiss?: () => void;
  className?: string;
  /** Full-screen overlay on small viewports. */
  mobileOverlay?: boolean;
}) {
  const ticker = catalyst.ticker?.trim().toUpperCase() || null;
  const [market, setMarket] = useState<QuotePayload | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(Boolean(ticker));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    // Lock scroll only when the panel is a full-screen mobile overlay.
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
    // Defer so setState is not synchronous in the effect body
    // (react-hooks/set-state-in-effect).
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

  const tvSymbol =
    market?.tradingViewSymbol ??
    (ticker ? toTradingViewSymbol(ticker, null) : null);
  const change = formatChange(
    market?.quote?.change,
    market?.quote?.changePercent,
  );

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
        <div className="min-w-0">
          <p className="font-mono text-[0.65rem] tracking-[0.18em] text-[var(--desk-live)] uppercase">
            {catalyst.headline ?? "Catalyst"}
          </p>
          <h2
            id={`tape-split-${catalyst.id}`}
            className="mt-0.5 truncate font-mono text-xl font-semibold tracking-tight text-[var(--desk-text)]"
          >
            {ticker ?? "—"}
          </h2>
          {(market?.profile?.name ?? catalyst.companyName) ? (
            <p className="mt-0.5 truncate text-sm text-[var(--desk-text-muted)]">
              {market?.profile?.name ?? catalyst.companyName}
            </p>
          ) : null}
          {ticker ? (
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-sm tabular-nums">
              {quoteLoading && !market?.quote ? (
                <span className="text-[var(--desk-text-dim)]">Loading…</span>
              ) : (
                <>
                  <span className="text-lg font-semibold text-[var(--desk-text)]">
                    {formatPrice(market?.quote?.price)}
                  </span>
                  <span
                    className={cn(
                      change.up === true && "text-emerald-400",
                      change.up === false && "text-rose-400",
                      change.up == null && "text-[var(--desk-text-muted)]",
                    )}
                  >
                    {change.text}
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
        <div className="shrink-0 border-b border-[var(--desk-border)] bg-[#0b0d10]">
          {tvSymbol ? (
            <TradingViewAdvancedChart
              key={tvSymbol}
              symbol={tvSymbol}
              className="h-[240px] sm:h-[280px]"
            />
          ) : (
            <div className="grid h-[180px] place-items-center px-4 text-center">
              <p className="font-mono text-xs text-[var(--desk-text-muted)]">
                No ticker on this catalyst — chart unavailable.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {catalyst.eventCategory ? (
              <CategoryBadge category={catalyst.eventCategory} />
            ) : null}
            <MaterialityBadge
              score={catalyst.impactScore}
              category={catalyst.eventCategory}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/catalyst/${catalyst.id}`}
              className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--desk-live)] px-3 py-1.5 font-mono text-xs font-semibold tracking-wide text-[#121212] uppercase hover:brightness-110"
            >
              <BookOpen className="size-3.5" />
              Full article
            </Link>
            <button
              type="button"
              onClick={() => onDismiss?.()}
              className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--desk-border-strong)] px-3 py-1.5 font-mono text-xs tracking-wide text-[var(--desk-text-muted)] uppercase hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
            >
              Dismiss
            </button>
          </div>

          <dl className="grid grid-cols-2 gap-3 font-mono text-xs">
            <div>
              <dt className="tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                Category
              </dt>
              <dd className="mt-1 text-sm text-[var(--desk-text)]">
                {catalyst.eventCategory
                  ? CATEGORY_LABELS[catalyst.eventCategory]
                  : "—"}
                {catalyst.subcategory
                  ? ` · ${catalyst.subcategory.replace(/_/g, " ")}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                Form
              </dt>
              <dd className="mt-1 text-sm text-[var(--desk-text)]">
                {catalyst.type}
              </dd>
            </div>
            <div>
              <dt className="tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                Age
              </dt>
              <dd className="mt-1 text-sm text-[var(--desk-text)] tabular-nums">
                {formatRelativeAge(catalyst.timestamp)}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                Event time
              </dt>
              <dd className="mt-1 text-sm text-[var(--desk-text)] tabular-nums">
                {formatEventTime(catalyst.timestamp)}
              </dd>
            </div>
          </dl>

          <div>
            <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
              Summary
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--desk-text-secondary)]">
              {catalyst.summary?.trim() ||
                catalyst.headline?.trim() ||
                catalyst.title}
            </p>
          </div>

          {catalyst.tags.length > 0 ? (
            <div>
              <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                Tags
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {catalyst.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-sm border border-[var(--desk-border)] px-1.5 py-0.5 font-mono text-[0.65rem] text-[var(--desk-text-muted)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {catalyst.items.length > 0 ? (
            <div>
              <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                Filing items
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {catalyst.items.map((item) => (
                  <li
                    key={item.code}
                    className="flex items-baseline gap-2 text-sm"
                  >
                    <span className="font-mono text-xs text-[var(--desk-text-secondary)] tabular-nums">
                      {item.code}
                    </span>
                    <span className="text-[var(--desk-text-secondary)]">
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
              Original source
            </p>
            <div className="mt-2">
              <EdgarProofLink
                url={catalyst.sourceUrl}
                provider={catalyst.sourceProvider}
              />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
