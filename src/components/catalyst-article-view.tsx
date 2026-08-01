"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, ExternalLink } from "lucide-react";

import { AiAnalysisPanel } from "@/components/ai-analysis-panel";
import { CategoryBadge } from "@/components/category-badge";
import { EdgarProofLink } from "@/components/edgar-proof-link";
import type { FeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import { benzingaPanelForCategory } from "@/lib/catalysts/benzinga-analogs";
import {
  sectorLabel,
  sourceDisplay,
  titleLine,
} from "@/lib/catalysts/feed-display";
import { type ArticleBodySource } from "@/lib/catalysts/article-content";
import type {
  ArticleDetailCard,
  DetailTone,
} from "@/lib/catalysts/article-detail";
import {
  segmentBeatMissWords,
  segmentCatalystHighlights,
  type DeltaSincePublish,
  type HighlightSegment,
  type HighlightTone,
} from "@/lib/catalysts/article-funnel";
import type { ArticleEnrichment } from "@/lib/catalysts/enrich-article";
import { formatMarketCapMillions } from "@/lib/catalysts/enrich-article-format";
import { isLocalDevUi } from "@/lib/dev/local-dev-ui";
import { formatRelativeAge, formatTimeDate } from "@/lib/format/relative-time";
import { CATEGORY_LABELS } from "@/lib/jobs/parse-8k-items";
import { feedHref } from "@/lib/nav/feed-href";
import { cn } from "@/lib/utils";

export type FilingProofMeta = {
  accessionNumber: string | null;
  filed: string | null;
  size: string | null;
};

export interface CatalystArticleViewProps {
  catalyst: FeedCatalyst;
  summary: string;
  summaryGenerated: boolean;
  body: string;
  bodySource: ArticleBodySource;
  detailCards?: ArticleDetailCard[];
  /** WIIM-style one-liner (already derived server-side). */
  whyMoving?: string | null;
  /** Up to three takeaway bullets. */
  takeaways?: string[];
  relatedSymbols?: string[];
  thumbUrl?: string | null;
  deltaSincePublish?: DeltaSincePublish | null;
  /** Soft-fail vendor enrichment (profile / related / quote). */
  enrichment?: ArticleEnrichment | null;
  /** Accession/size — secondary proof only (never article body). */
  filingProofMeta?: FilingProofMeta | null;
  /** `dialog` hides the feed back-link (modal chrome owns dismiss). */
  variant?: "page" | "dialog";
  /**
   * Kept for call-site compatibility. Outbound vendor proof links are gated
   * inside `EdgarProofLink` (local-dev only).
   */
  isAdmin?: boolean;
  /** When true, show vendor source in the details meta grid. */
  showSourceLabels?: boolean;
}

/**
 * Expanded in-app event details for a single catalyst.
 * Catalyst Intel is the product source of truth; vendor URL proof links are
 * local-dev only.
 */
export function CatalystArticleView({
  catalyst,
  summary,
  summaryGenerated,
  body,
  bodySource,
  detailCards = [],
  whyMoving = null,
  takeaways = [],
  relatedSymbols = [],
  thumbUrl = null,
  deltaSincePublish = null,
  enrichment = null,
  filingProofMeta = null,
  variant = "page",
  showSourceLabels = false,
}: CatalystArticleViewProps) {
  const categoryLabel = catalyst.eventCategory
    ? CATEGORY_LABELS[catalyst.eventCategory]
    : null;
  const subcategory = catalyst.subcategory?.replace(/_/g, " ") || null;
  const panelAnalog = benzingaPanelForCategory(catalyst.eventCategory);
  const symbol = catalyst.symbol?.trim().toUpperCase() || null;
  const eventTitle = titleLine(catalyst);

  return (
    <article
      className={cn(
        "desk-arial mx-auto flex w-full flex-1 flex-col gap-5",
        variant === "page" ? "max-w-3xl pb-10" : "max-w-none pb-2",
      )}
    >
      {variant === "page" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--desk-border)] pb-3">
          <Link
            href={feedHref({ catalystId: catalyst.id })}
            className="inline-flex items-center gap-1.5 font-mono text-[0.72rem] tracking-wide text-[var(--desk-text-muted)] uppercase transition-colors hover:text-[var(--desk-text)]"
          >
            <ArrowLeft className="size-3.5" />
            Catalyst Feed
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <EdgarProofLink
              url={catalyst.sourceUrl}
              provider={catalyst.sourceProvider}
            />
            <span className="inline-flex items-center gap-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-live)] uppercase">
              <BookOpen className="size-3.5" />
              Details
            </span>
          </div>
        </div>
      ) : null}

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {symbol ? (
            <span className="font-mono text-2xl font-semibold tracking-tight text-[var(--desk-text)] sm:text-3xl">
              {symbol}
            </span>
          ) : (
            <span className="rounded-sm border border-[var(--desk-warn-border)] bg-[var(--desk-warn-bg)] px-2 py-1 font-mono text-[0.7rem] tracking-wide text-[var(--desk-warn-text)] uppercase">
              Symbol unresolved
            </span>
          )}
          {relatedSymbols.length > 0 ? (
            <div
              className="flex flex-wrap items-center gap-1.5"
              aria-label="Related symbols"
            >
              {relatedSymbols.map((t) => (
                <span
                  key={t}
                  className="rounded-sm border border-[var(--desk-border-strong)] bg-[var(--desk-overlay-soft)] px-1.5 py-0.5 font-mono text-[0.7rem] tracking-wide text-[var(--desk-text-secondary)] transition-colors hover:border-[var(--desk-text-dim)] hover:text-[var(--desk-text)]"
                  title={`Related · ${t}`}
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          {catalyst.eventCategory ? (
            <CategoryBadge category={catalyst.eventCategory} />
          ) : null}
          {variant === "dialog" ? (
            <EdgarProofLink
              url={catalyst.sourceUrl}
              provider={catalyst.sourceProvider}
            />
          ) : null}
        </div>

        <h1 className="desk-heading text-[var(--desk-text)] sm:text-[1.5rem]">
          {eventTitle}
        </h1>

        {catalyst.companyName ? (
          <p className="desk-body text-[var(--desk-text-muted)]">
            {catalyst.companyName}
          </p>
        ) : null}

        {!symbol ? (
          <p className="desk-data leading-snug text-[var(--desk-text-dim)]">
            No tradable symbol on this catalyst — use the summary and text
            below.
          </p>
        ) : null}

        {whyMoving ? (
          <div
            className="border-l-2 border-[var(--desk-live)] pl-3"
            role="note"
            aria-label="Why it's moving"
          >
            <p className="font-mono text-[0.62rem] tracking-[0.14em] text-[var(--desk-live)] uppercase">
              Why it&apos;s moving
            </p>
            <p className="mt-1 text-sm leading-snug text-[var(--desk-text)]">
              {whyMoving}
            </p>
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-3">
          <MetaCell
            label="Category"
            value={
              [categoryLabel, subcategory].filter(Boolean).join(" · ") || "—"
            }
          />
          <MetaCell label="Type" value={catalyst.type || "—"} />
          <MetaCell label="Sector" value={sectorLabel(catalyst)} />
          {showSourceLabels ? (
            <MetaCell label="Source" value={sourceDisplay(catalyst).name} />
          ) : null}
          <MetaCell
            label="Event time"
            value={formatTimeDate(catalyst.timestamp)}
            tabular
          />
          {panelAnalog ? <MetaCell label="Panel" value={panelAnalog} /> : null}
        </dl>

        {(thumbUrl || deltaSincePublish) && (
          <div className="flex flex-wrap items-end gap-4">
            {thumbUrl ? (
              // Optional compact source still — only when vendor stored a URL.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbUrl}
                alt=""
                width={180}
                height={101}
                className="h-[72px] w-[128px] rounded-sm border border-[var(--desk-border)] object-cover opacity-90 transition-opacity hover:opacity-100"
              />
            ) : null}
            {deltaSincePublish ? (
              <p className="font-mono text-xs tracking-wide text-[var(--desk-text-secondary)] tabular-nums">
                <span className="text-[var(--desk-text-dim)] uppercase">
                  Δ since publish
                </span>
                <span className="mx-1.5 text-[var(--desk-text-dim)]">·</span>
                <span
                  className={cn(
                    deltaSincePublish.pctChange > 0 &&
                      "text-[var(--desk-positive)]",
                    deltaSincePublish.pctChange < 0 &&
                      "text-[var(--desk-negative)]",
                  )}
                >
                  {deltaSincePublish.pctChange > 0 ? "+" : ""}
                  {deltaSincePublish.pctChange.toFixed(2)}%
                </span>
                {deltaSincePublish.date ? (
                  <span className="ml-1.5 text-[var(--desk-text-dim)]">
                    {deltaSincePublish.date}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        )}
      </header>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
            {takeaways.length > 0 ? "Takeaways" : "Summary"}
          </h2>
          {summaryGenerated ? (
            <span className="font-mono text-[0.6rem] tracking-wide text-[var(--desk-text-dim)] uppercase">
              Extractive
            </span>
          ) : null}
        </div>
        {takeaways.length > 0 ? (
          <ul className="flex list-none flex-col gap-1.5 pl-0">
            {takeaways.map((bullet, i) => (
              <li
                key={`takeaway-${i}`}
                className="flex gap-2 text-[0.95rem] leading-relaxed text-[var(--desk-text-secondary)]"
              >
                <span
                  className="mt-2 size-1 shrink-0 rounded-full bg-[var(--desk-live)]"
                  aria-hidden
                />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[0.95rem] leading-relaxed text-[var(--desk-text-secondary)]">
            {summary || "No summary available for this catalyst yet."}
          </p>
        )}
      </section>

      <AiAnalysisPanel
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
      />

      {detailCards.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
            Detail
          </h2>
          <div className="flex flex-col gap-3">
            {detailCards.map((card) => (
              <DetailCardPanel key={card.id} card={card} />
            ))}
          </div>
        </section>
      ) : null}

      {catalyst.keyFacts.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
            Key facts
          </h2>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {catalyst.keyFacts.slice(0, 8).map((fact) => (
              <div
                key={`${fact.label}:${fact.value}`}
                className="rounded-sm border border-[var(--desk-border)] bg-[var(--desk-overlay-soft)] px-2.5 py-2"
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
      ) : null}

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
            Full text
          </h2>
          {isLocalDevUi() ? (
            <span className="font-mono text-[0.6rem] tracking-wide text-[var(--desk-text-dim)] uppercase">
              {bodySourceLabel(bodySource)}
            </span>
          ) : null}
        </div>
        {body ? (
          <div
            className={cn(
              "rounded-sm border border-[var(--desk-border)] bg-[var(--desk-overlay-soft)] px-4 py-4 text-[0.92rem] leading-relaxed whitespace-pre-wrap text-[var(--desk-text-secondary)]",
            )}
          >
            <HighlightedText text={body} />
          </div>
        ) : (
          <p className="rounded-sm border border-dashed border-[var(--desk-border-strong)] px-4 py-4 text-sm text-[var(--desk-text-muted)]">
            No stored event text for this row yet. Summary and takeaways above
            are the available in-app content.
          </p>
        )}
        {isLocalDevUi() && filingProofMeta ? (
          <FilingProofMetaLine meta={filingProofMeta} />
        ) : null}
      </section>

      {catalyst.items.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
            Filing items
          </h2>
          <ul className="flex flex-col gap-1.5">
            {catalyst.items.map((item) => (
              <li
                key={item.code}
                className="flex items-baseline gap-2 text-sm text-[var(--desk-text-secondary)]"
              >
                <span className="font-mono text-xs text-[var(--desk-text-dim)] tabular-nums">
                  {item.code}
                </span>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {catalyst.tags.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
            Tags
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {catalyst.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-sm border border-[var(--desk-border)] px-1.5 py-0.5 font-mono text-[0.65rem] text-[var(--desk-text-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {enrichment?.profile ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
            About the company
          </h2>
          <dl className="grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
            <MetaCell
              label="Name"
              value={enrichment.profile.name || catalyst.companyName || "—"}
            />
            <MetaCell
              label="Industry"
              value={enrichment.profile.industry || "—"}
            />
            <MetaCell
              label="Exchange"
              value={
                [enrichment.profile.exchange, enrichment.profile.country]
                  .filter(Boolean)
                  .join(" · ") || "—"
              }
            />
            <MetaCell
              label="Market cap"
              value={
                formatMarketCapMillions(enrichment.profile.marketCapMillions) ||
                "—"
              }
            />
          </dl>
          {enrichment.profile.webUrl ? (
            <a
              href={enrichment.profile.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1.5 font-mono text-[0.7rem] tracking-wide text-[var(--desk-text-muted)] uppercase transition-colors hover:text-[var(--desk-text)]"
            >
              <ExternalLink className="size-3" />
              Company site
            </a>
          ) : null}
        </section>
      ) : null}

      {enrichment && enrichment.relatedHeadlines.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
            Related headlines
          </h2>
          <ul className="flex list-none flex-col gap-2 pl-0">
            {enrichment.relatedHeadlines.map((item, i) => {
              const age = item.publishedAt
                ? formatRelativeAge(item.publishedAt)
                : null;
              const inner = (
                <>
                  <span className="text-sm leading-snug text-[var(--desk-text)]">
                    {item.title}
                  </span>
                  {age ? (
                    <span className="mt-0.5 font-mono text-[0.65rem] tracking-wide text-[var(--desk-text-dim)]">
                      {age}
                    </span>
                  ) : null}
                </>
              );
              return (
                <li
                  key={`related-${item.catalystId ?? i}-${item.title.slice(0, 24)}`}
                  className="border-t border-[var(--desk-border)] pt-2 first:border-t-0 first:pt-0"
                >
                  {item.catalystId != null ? (
                    <Link
                      href={`/catalyst-feed/catalyst/${item.catalystId}`}
                      className="flex flex-col transition-colors hover:opacity-90"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex flex-col">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {enrichment?.quote ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
            Market context
          </h2>
          <dl className="grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
            <MetaCell
              label="Last"
              value={
                enrichment.quote.price != null
                  ? `$${enrichment.quote.price.toFixed(2)}`
                  : "—"
              }
              tabular
            />
            <div>
              <dt className="tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
                Session
              </dt>
              <dd
                className={cn(
                  "mt-1 text-sm tabular-nums",
                  (enrichment.quote.changePercent ?? 0) > 0 &&
                    "text-[var(--desk-positive)]",
                  (enrichment.quote.changePercent ?? 0) < 0 &&
                    "text-[var(--desk-negative)]",
                  (enrichment.quote.changePercent ?? 0) === 0 &&
                    "text-[var(--desk-text)]",
                )}
              >
                {enrichment.quote.changePercent != null
                  ? `${enrichment.quote.changePercent > 0 ? "+" : ""}${enrichment.quote.changePercent.toFixed(2)}%`
                  : "—"}
                {enrichment.quote.change != null ? (
                  <span className="ml-1.5 text-[var(--desk-text-dim)]">
                    ({enrichment.quote.change > 0 ? "+" : ""}
                    {enrichment.quote.change.toFixed(2)})
                  </span>
                ) : null}
              </dd>
            </div>
            <MetaCell
              label="Open / prev"
              value={
                [
                  enrichment.quote.open != null
                    ? `$${enrichment.quote.open.toFixed(2)}`
                    : null,
                  enrichment.quote.previousClose != null
                    ? `$${enrichment.quote.previousClose.toFixed(2)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" / ") || "—"
              }
              tabular
            />
            <MetaCell
              label="Range"
              value={
                enrichment.quote.low != null && enrichment.quote.high != null
                  ? `$${enrichment.quote.low.toFixed(2)} – $${enrichment.quote.high.toFixed(2)}`
                  : "—"
              }
              tabular
            />
          </dl>
          {enrichment.quote.asOf ? (
            <p className="font-mono text-[0.6rem] tracking-wide text-[var(--desk-text-dim)] uppercase">
              As of {formatRelativeAge(enrichment.quote.asOf)}
            </p>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}

function MetaCell({
  label,
  value,
  tabular = false,
}: {
  label: string;
  value: string;
  tabular?: boolean;
}) {
  return (
    <div>
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

function DetailCardPanel({ card }: { card: ArticleDetailCard }) {
  return (
    <div className="rounded-sm border border-[var(--desk-border)] bg-[var(--desk-overlay-soft)] px-4 py-4 transition-colors hover:border-[var(--desk-text-dim)]">
      <h3 className="font-mono text-[0.7rem] tracking-[0.12em] text-[var(--desk-text)] uppercase">
        {card.title}
      </h3>
      {card.intro ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--desk-text-secondary)]">
          <HighlightedText text={card.intro} />
        </p>
      ) : null}
      {card.fields.length > 0 ? (
        <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {card.fields.map((field) => (
            <div
              key={`${card.id}-${field.label}`}
              className="flex flex-col gap-0.5 border-t border-[var(--desk-border)] pt-2 first:border-t-0 first:pt-0 sm:first:border-t sm:first:pt-2"
            >
              <dt className="font-mono text-[0.6rem] tracking-[0.12em] text-[var(--desk-text-dim)] uppercase">
                {field.label}
              </dt>
              <dd className={cn("text-sm tabular-nums", toneClass(field.tone))}>
                <BeatMissFieldValue value={field.value} tone={field.tone} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function BeatMissFieldValue({
  value,
  tone,
}: {
  value: string;
  tone?: DetailTone;
}) {
  // Only accent literal Beat/Miss words; keep numeric tone via parent class.
  const segs = segmentBeatMissWords(value);
  const hasAccent = segs.some((s) => s.type === "accent");
  if (!hasAccent) {
    return <span className={toneClass(tone)}>{value}</span>;
  }
  return (
    <span>
      {segs.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <span key={i} className={accentClass(seg.tone)}>
            {seg.value}
          </span>
        ),
      )}
    </span>
  );
}

function HighlightedText({ text }: { text: string }) {
  const segs = segmentCatalystHighlights(text);
  return <>{segs.map((seg, i) => renderSegment(seg, i))}</>;
}

function renderSegment(seg: HighlightSegment, key: number) {
  if (seg.type === "text") {
    return <span key={key}>{seg.value}</span>;
  }
  return (
    <span key={key} className={accentClass(seg.tone)}>
      {seg.value}
    </span>
  );
}

function accentClass(tone: HighlightTone): string {
  switch (tone) {
    case "positive":
      return "font-medium text-[var(--desk-positive)]";
    case "negative":
      return "font-medium text-[var(--desk-negative)]";
    default:
      return "font-medium text-[var(--desk-text)]";
  }
}

function toneClass(tone?: DetailTone): string {
  switch (tone) {
    case "positive":
      return "text-[var(--desk-positive)]";
    case "negative":
      return "text-[var(--desk-negative)]";
    case "neutral":
      return "text-[var(--desk-text)]";
    default:
      return "text-[var(--desk-text)]";
  }
}

function bodySourceLabel(source: ArticleBodySource): string {
  switch (source) {
    case "raw":
      return "from extract / raw";
    case "summary":
      return "from summary";
    case "title":
      return "from title";
    default:
      return "empty";
  }
}

/** Local-dev only — AccNo/Size as proof metadata, never primary copy. */
function FilingProofMetaLine({ meta }: { meta: FilingProofMeta }) {
  const parts = [
    meta.filed ? `Filed ${meta.filed}` : null,
    meta.accessionNumber ? `AccNo ${meta.accessionNumber}` : null,
    meta.size ? `Size ${meta.size}` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <p className="font-mono text-[0.6rem] tracking-wide text-[var(--desk-text-dim)] uppercase">
      {parts.join(" · ")}
    </p>
  );
}
