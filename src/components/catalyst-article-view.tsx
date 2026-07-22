"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, ExternalLink } from "lucide-react";

import { CategoryBadge } from "@/components/category-badge";
import { MaterialityBadge } from "@/components/materiality-badge";
import type { FeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import { sourceDisplay, titleLine } from "@/lib/catalysts/feed-display";
import {
  originalSourceLabel,
  type ArticleBodySource,
} from "@/lib/catalysts/article-content";
import type {
  ArticleDetailCard,
  DetailTone,
} from "@/lib/catalysts/article-detail";
import { formatTimeDate } from "@/lib/format/relative-time";
import { CATEGORY_LABELS } from "@/lib/jobs/parse-8k-items";
import { cn } from "@/lib/utils";

export interface CatalystArticleViewProps {
  catalyst: FeedCatalyst;
  summary: string;
  summaryGenerated: boolean;
  body: string;
  bodySource: ArticleBodySource;
  detailCards?: ArticleDetailCard[];
}

/**
 * Full-page in-app article reader for a single catalyst.
 * Primary path stays inside Catalyst; original vendor URL is secondary.
 */
export function CatalystArticleView({
  catalyst,
  summary,
  summaryGenerated,
  body,
  bodySource,
  detailCards = [],
}: CatalystArticleViewProps) {
  const source = sourceDisplay(catalyst);
  const originalLabel = originalSourceLabel(catalyst.sourceProvider);
  const categoryLabel = catalyst.eventCategory
    ? CATEGORY_LABELS[catalyst.eventCategory]
    : null;
  const subcategory = catalyst.subcategory?.replace(/_/g, " ") || null;

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--desk-border)] pb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 font-mono text-[0.72rem] tracking-wide text-[var(--desk-text-muted)] uppercase transition-colors hover:text-[var(--desk-text)]"
        >
          <ArrowLeft className="size-3.5" />
          Live tape
        </Link>
        <span className="inline-flex items-center gap-1.5 font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-live)] uppercase">
          <BookOpen className="size-3.5" />
          In-app article
        </span>
      </div>

      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-2xl font-semibold tracking-tight text-[var(--desk-text)] sm:text-3xl">
            {catalyst.ticker ?? "—"}
          </span>
          {catalyst.eventCategory ? (
            <CategoryBadge category={catalyst.eventCategory} />
          ) : null}
          <MaterialityBadge
            score={catalyst.impactScore}
            category={catalyst.eventCategory}
          />
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-[var(--desk-text)] sm:text-2xl">
          {titleLine(catalyst)}
        </h1>

        {catalyst.companyName ? (
          <p className="text-sm text-[var(--desk-text-muted)]">
            {catalyst.companyName}
          </p>
        ) : null}

        <dl className="grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
          <MetaCell label="Provider" value={source.name} />
          <MetaCell
            label="Category"
            value={
              [categoryLabel, subcategory].filter(Boolean).join(" · ") || "—"
            }
          />
          <MetaCell label="Type" value={catalyst.type || "—"} />
          <MetaCell
            label="Time"
            value={formatTimeDate(catalyst.timestamp)}
            tabular
          />
        </dl>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-[var(--desk-live)] px-3 py-1.5 font-mono text-xs font-semibold tracking-wide text-[#121212] uppercase">
            <BookOpen className="size-3.5" />
            Open in Catalyst
          </span>
          {catalyst.sourceUrl ? (
            <a
              href={catalyst.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--desk-border-strong)] bg-white/[0.03] px-3 py-1.5 font-mono text-xs tracking-wide text-[var(--desk-text-secondary)] uppercase transition-colors hover:border-white/30 hover:text-[var(--desk-text)]"
            >
              <ExternalLink className="size-3.5" />
              {originalLabel}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--desk-border)] px-3 py-1.5 font-mono text-xs tracking-wide text-[var(--desk-text-dim)] uppercase">
              No original URL
            </span>
          )}
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
            Summary
          </h2>
          {summaryGenerated ? (
            <span className="font-mono text-[0.6rem] tracking-wide text-[var(--desk-text-dim)] uppercase">
              Extractive · Groq later
            </span>
          ) : null}
        </div>
        <p className="text-[0.95rem] leading-relaxed text-[var(--desk-text-secondary)]">
          {summary || "No summary available for this catalyst yet."}
        </p>
      </section>

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

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-text-dim)] uppercase">
            Article body
          </h2>
          <span className="font-mono text-[0.6rem] tracking-wide text-[var(--desk-text-dim)] uppercase">
            {bodySourceLabel(bodySource)}
          </span>
        </div>
        {body ? (
          <div
            className={cn(
              "rounded-sm border border-[var(--desk-border)] bg-white/[0.02] px-4 py-4 text-[0.92rem] leading-relaxed whitespace-pre-wrap text-[var(--desk-text-secondary)]",
            )}
          >
            {body}
          </div>
        ) : (
          <p className="rounded-sm border border-dashed border-[var(--desk-border-strong)] px-4 py-4 text-sm text-[var(--desk-text-muted)]">
            No stored article text for this row. Use the original source link
            when you need the full external page — we do not iframe blocked
            sites.
          </p>
        )}
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
    <div className="rounded-sm border border-[var(--desk-border)] bg-white/[0.02] px-4 py-4">
      <h3 className="font-mono text-[0.7rem] tracking-[0.12em] text-[var(--desk-text)] uppercase">
        {card.title}
      </h3>
      {card.intro ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--desk-text-secondary)]">
          {card.intro}
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
              <dd
                className={cn(
                  "text-sm text-[var(--desk-text)] tabular-nums",
                  toneClass(field.tone),
                )}
              >
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function toneClass(tone?: DetailTone): string {
  switch (tone) {
    case "positive":
      return "text-[var(--desk-live)]";
    case "negative":
      return "text-red-400";
    case "neutral":
      return "text-[var(--desk-text)]";
    default:
      return "text-[var(--desk-text)]";
  }
}

function bodySourceLabel(source: ArticleBodySource): string {
  switch (source) {
    case "raw":
      return "From stored payload";
    case "summary":
      return "From summary field";
    case "title":
      return "Title fallback";
    default:
      return "Unavailable";
  }
}
