"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { MessageSquareText, X } from "lucide-react";

import { FeedbackDialog } from "@/components/feedback-dialog";
import { EARLY_ACCESS } from "@/lib/early-access";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "ci.earlyAccessBannerDismissed";

function subscribeDismiss(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getDismissedSnapshot() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function getDismissedServerSnapshot() {
  return false;
}

type EarlyAccessBannerProps = {
  /** Marketing pages sit above the pre-login header; desk sits above AppShell. */
  variant?: "marketing" | "app";
  /** When false, hide the feedback CTA (e.g. login before session). */
  showFeedback?: boolean;
  /** Prefills feedback reply-to when signed in. */
  defaultEmail?: string | null;
  className?: string;
};

/**
 * Persistent top strip announcing Open Early Access (all features free).
 * In-app variant is dismissible per browser; marketing stays visible.
 */
export function EarlyAccessBanner({
  variant = "marketing",
  showFeedback = true,
  defaultEmail,
  className,
}: EarlyAccessBannerProps) {
  const storedDismissed = useSyncExternalStore(
    subscribeDismiss,
    getDismissedSnapshot,
    getDismissedServerSnapshot,
  );
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const dismissed = variant === "app" && (storedDismissed || sessionDismissed);

  const dismiss = useCallback(() => {
    setSessionDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
      window.dispatchEvent(new Event("storage"));
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  if (dismissed) {
    return null;
  }

  return (
    <>
      <div
        role="status"
        className={cn(
          "relative z-50 flex items-center justify-center gap-2 border-b px-3 py-2 text-center sm:gap-3 sm:px-5",
          variant === "marketing"
            ? "border-[color-mix(in_srgb,var(--landing-primary,#2563eb)_28%,transparent)] bg-[color-mix(in_srgb,var(--landing-primary,#2563eb)_10%,transparent)]"
            : "border-[color-mix(in_srgb,var(--desk-live)_28%,transparent)] bg-[color-mix(in_srgb,var(--desk-live)_12%,transparent)]",
          variant === "app" && "pr-11 sm:pr-12",
          className,
        )}
      >
        <p className="min-w-0 text-[0.78rem] leading-snug font-medium text-[var(--desk-text)] sm:text-[0.82rem]">
          <span
            className={cn(
              "font-mono text-[0.68rem] font-bold tracking-[0.1em] uppercase",
              variant === "marketing"
                ? "text-[var(--landing-primary,#2563eb)]"
                : "text-[var(--desk-live)]",
            )}
          >
            {EARLY_ACCESS.badge}
          </span>
          <span className="mx-1.5 text-[var(--desk-text-dim)]" aria-hidden>
            ·
          </span>
          <span className="text-pretty">{EARLY_ACCESS.headline}</span>
        </p>
        {showFeedback ? (
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className={cn(
              "btn-press inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 font-mono text-[0.65rem] font-semibold tracking-[0.06em] uppercase transition-colors",
              variant === "marketing"
                ? "border-[color-mix(in_srgb,var(--landing-primary,#2563eb)_40%,transparent)] bg-[color-mix(in_srgb,var(--landing-primary,#2563eb)_08%,transparent)] text-[var(--landing-primary,#2563eb)] hover:bg-[color-mix(in_srgb,var(--landing-primary,#2563eb)_18%,transparent)]"
                : "border-[color-mix(in_srgb,var(--desk-live)_40%,transparent)] bg-[color-mix(in_srgb,var(--desk-live)_08%,transparent)] text-[var(--desk-live)] hover:bg-[color-mix(in_srgb,var(--desk-live)_18%,transparent)]",
            )}
          >
            <MessageSquareText className="size-3" aria-hidden />
            <span className="hidden sm:inline">Feedback</span>
          </button>
        ) : null}
        {variant === "app" ? (
          <button
            type="button"
            aria-label="Dismiss Early Access banner"
            onClick={dismiss}
            className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--desk-text-muted)] transition-colors hover:bg-[var(--desk-overlay-strong)] hover:text-[var(--desk-text)] sm:right-3"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      {showFeedback ? (
        <FeedbackDialog
          open={feedbackOpen}
          onOpenChange={setFeedbackOpen}
          defaultEmail={defaultEmail}
        />
      ) : null}
    </>
  );
}
