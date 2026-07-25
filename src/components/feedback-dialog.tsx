"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
  isFeedbackCategory,
} from "@/lib/early-access";
import { cn } from "@/lib/utils";

type FeedbackDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill when the user is signed in (optional on marketing pages). */
  defaultEmail?: string | null;
};

/**
 * Collects bugs, feature requests, and improvement ideas and posts to
 * `/api/feedback` (emailed to FEEDBACK_TO_EMAIL via Resend).
 */
export function FeedbackDialog({
  open,
  onOpenChange,
  defaultEmail,
}: FeedbackDialogProps) {
  const [category, setCategory] = useState<FeedbackCategory>("feature");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(defaultEmail?.trim() ?? "");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCategory("feature");
    setMessage("");
    setEmail(defaultEmail?.trim() ?? "");
  };

  const submit = async () => {
    const trimmed = message.trim();
    if (trimmed.length < 10) {
      toast.error("Please write at least a short note (10+ characters).");
      return;
    }
    if (!defaultEmail?.trim() && !email.trim()) {
      toast.error("Add an email so we can follow up if needed.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: trimmed,
          email: email.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Could not send feedback. Try again.");
        return;
      }
      toast.success("Thanks — we got your feedback.");
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Network error — feedback not sent.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md" overlayClassName="z-[60]">
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>
            Bugs, feature requests, or ideas to improve the desk. We read every
            note.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="feedback-category">Type</Label>
            <div
              id="feedback-category"
              role="group"
              aria-label="Feedback type"
              className="flex flex-wrap gap-1.5"
            >
              {FEEDBACK_CATEGORIES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setCategory(item.value)}
                  className={cn(
                    "btn-press rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    category === item.value
                      ? "border-[rgba(240,193,75,0.45)] bg-[rgba(240,193,75,0.14)] text-[var(--desk-text)]"
                      : "border-[var(--desk-border-strong)] text-[var(--desk-text-muted)] hover:bg-[var(--desk-overlay-soft)] hover:text-[var(--desk-text)]",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-message">Your note</Label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder={
                category === "bug"
                  ? "What happened, and what did you expect?"
                  : category === "feature"
                    ? "What would you like to see on the desk?"
                    : "What should we improve?"
              }
              className="w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            />
            <p className="font-mono text-[0.65rem] text-muted-foreground tabular-nums">
              {message.trim().length}/4000
            </p>
          </div>

          {!defaultEmail?.trim() ? (
            <div className="space-y-1.5">
              <Label htmlFor="feedback-email">Email</Label>
              <Input
                id="feedback-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@firm.com"
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="btn-press bg-[var(--desk-live)] text-[#121212] hover:brightness-110"
            onClick={() => {
              if (!isFeedbackCategory(category)) {
                return;
              }
              void submit();
            }}
            disabled={submitting}
          >
            {submitting ? "Sending…" : "Send feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
