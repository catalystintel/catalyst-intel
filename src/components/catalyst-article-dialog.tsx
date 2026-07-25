"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

import { CatalystArticleView } from "@/components/catalyst-article-view";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import { toFeedCatalyst } from "@/lib/catalysts/feed-catalyst";
import type { ArticleBodySource } from "@/lib/catalysts/article-content";
import type { ArticleDetailCard } from "@/lib/catalysts/article-detail";
import type { ArticleEnrichment } from "@/lib/catalysts/enrich-article";
import {
  deriveTakeaways,
  deriveWhyMoving,
  parseDeltaSincePublish,
} from "@/lib/catalysts/article-funnel";
import { titleLine } from "@/lib/catalysts/feed-display";
import { cn } from "@/lib/utils";

type ArticlePayload = {
  summary: string;
  summaryGenerated: boolean;
  body: string;
  bodySource: ArticleBodySource;
  detailCards?: ArticleDetailCard[];
  enrichment?: ArticleEnrichment | null;
};

type LoadState =
  | { status: "idle" }
  | { status: "loading"; catalystId: number }
  | {
      status: "ready";
      catalystId: number;
      catalyst: FeedCatalyst;
      article: ArticlePayload;
    }
  | { status: "error"; catalystId: number; message: string };

/**
 * Full-article reading surface as a highlighted modal — deeper than the
 * tape split triage panel (body, takeaways, detail cards, enrichment).
 */
export function CatalystArticleDialog({
  catalystId,
  open,
  onOpenChange,
}: {
  catalystId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [load, setLoad] = useState<LoadState>({ status: "idle" });

  useEffect(() => {
    if (!open || catalystId == null) return;

    let cancelled = false;
    const controller = new AbortController();
    const id = catalystId;

    void (async () => {
      setLoad({ status: "loading", catalystId: id });
      try {
        const res = await fetch(`/api/catalysts/${id}`, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await res.json()) as {
          catalyst?: Parameters<typeof toFeedCatalyst>[0];
          article?: ArticlePayload;
          error?: string;
        };
        if (!res.ok || !data.catalyst || !data.article) {
          throw new Error(data.error ?? "Could not load article.");
        }
        if (cancelled) return;
        setLoad({
          status: "ready",
          catalystId: id,
          catalyst: toFeedCatalyst(data.catalyst),
          article: data.article,
        });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoad({
          status: "error",
          catalystId: id,
          message:
            err instanceof Error ? err.message : "Could not load article.",
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, catalystId]);

  const active =
    open &&
    catalystId != null &&
    (load.status === "loading" ||
      load.status === "ready" ||
      load.status === "error") &&
    load.catalystId === catalystId
      ? load
      : open && catalystId != null
        ? ({ status: "loading", catalystId } as const)
        : null;

  const ready = active?.status === "ready" ? active : null;
  const heading =
    ready != null
      ? titleLine(ready.catalyst, { maxBlurbChars: 200 })
      : "Article";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[100] bg-black/65 supports-backdrop-filter:backdrop-blur-sm"
        className={cn(
          "z-[110] flex max-h-[min(92vh,920px)] w-[min(100%-1.5rem,52rem)] max-w-none translate-y-[-50%] flex-col gap-0 overflow-hidden rounded-xl border border-[var(--desk-border-strong)] bg-[var(--desk-panel)] p-0 text-[var(--desk-text)] shadow-[0_28px_90px_rgba(0,0,0,0.55)] ring-1 ring-[var(--desk-live)]/30 sm:max-w-none",
        )}
      >
        <DialogHeader className="shrink-0 gap-0 border-b border-[var(--desk-border)] bg-[var(--desk-header)] px-4 py-3 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[0.65rem] tracking-[0.14em] text-[var(--desk-live)] uppercase">
                Full article
              </p>
              <DialogTitle className="mt-1 line-clamp-2 text-base font-semibold tracking-tight text-[var(--desk-text)] sm:text-lg">
                {heading}
              </DialogTitle>
              <DialogDescription className="sr-only">
                In-app article reader for this catalyst
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--desk-border-strong)] text-[var(--desk-text-muted)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)]"
              aria-label="Close article"
            >
              <X className="size-4" />
            </button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {active?.status === "loading" ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-[var(--desk-text-muted)]">
              <Loader2 className="size-5 animate-spin text-[var(--desk-live)]" />
              <p className="font-mono text-xs tracking-wide uppercase">
                Loading article…
              </p>
            </div>
          ) : null}
          {active?.status === "error" ? (
            <p className="rounded-sm border border-dashed border-[var(--desk-border-strong)] px-4 py-6 text-center text-sm text-[var(--desk-text-muted)]">
              {active.message}
            </p>
          ) : null}
          {ready ? (
            <CatalystArticleView
              variant="dialog"
              catalyst={ready.catalyst}
              summary={ready.article.summary}
              summaryGenerated={ready.article.summaryGenerated}
              body={ready.article.body}
              bodySource={ready.article.bodySource}
              detailCards={ready.article.detailCards ?? []}
              whyMoving={deriveWhyMoving({
                summary: ready.article.summary,
                headline: ready.catalyst.headline,
                title: ready.catalyst.title,
                detailCards: ready.article.detailCards ?? [],
                delta: parseDeltaSincePublish(ready.catalyst.historicalImpact),
              })}
              takeaways={deriveTakeaways(
                ready.article.summary,
                ready.article.body,
              )}
              relatedTickers={[]}
              thumbUrl={null}
              deltaSincePublish={parseDeltaSincePublish(
                ready.catalyst.historicalImpact,
              )}
              enrichment={ready.article.enrichment ?? null}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
