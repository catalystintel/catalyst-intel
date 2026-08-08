"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type TipSide = "top" | "bottom";

const GAP_PX = 6;
const PAD_PX = 10;

/**
 * Fast desk-styled hover tip (replaces delayed native `title=` tooltips).
 * Portals above/below the anchor so feed rows and sticky headers don't clip it.
 * Clamps horizontally so edge controls (e.g. Quiet) don't cut the tip off-screen.
 */
export function DeskTip({
  content,
  children,
  side = "bottom",
  className,
  disabled = false,
}: {
  content: string;
  children: ReactNode;
  side?: TipSide;
  className?: string;
  /** When true, tip is suppressed (e.g. control loading). */
  disabled?: boolean;
}) {
  const tipId = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placed: TipSide;
    maxWidth: number;
  } | null>(null);

  const hide = useCallback(() => setCoords(null), []);

  const place = useCallback(() => {
    if (disabled || !content.trim()) return;
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const maxWidth = Math.min(320, window.innerWidth - PAD_PX * 2);

    const tipClearance = 36;
    let placed: TipSide = side;
    if (placed === "top" && r.top - tipClearance < PAD_PX) {
      placed = "bottom";
    } else if (
      placed === "bottom" &&
      r.bottom + tipClearance > window.innerHeight - PAD_PX
    ) {
      placed = "top";
    }

    // Prefer centering under the anchor; useLayoutEffect will clamp once
    // the tip width is known so right-edge buttons stay fully readable.
    const left = r.left + r.width / 2;
    const top = placed === "top" ? r.top - GAP_PX : r.bottom + GAP_PX;
    setCoords({ top, left, placed, maxWidth });
  }, [content, disabled, side]);

  useLayoutEffect(() => {
    if (!coords || !tipRef.current) return;
    const tipWidth = tipRef.current.getBoundingClientRect().width;
    const half = tipWidth / 2;
    const minLeft = PAD_PX + half;
    const maxLeft = window.innerWidth - PAD_PX - half;
    const clampedLeft = Math.min(Math.max(coords.left, minLeft), maxLeft);
    if (Math.abs(clampedLeft - coords.left) > 0.5) {
      setCoords((prev) => (prev ? { ...prev, left: clampedLeft } : prev));
    }
  }, [coords]);

  useEffect(() => {
    if (!coords) return;
    const onReposition = () => hide();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [coords, hide]);

  return (
    <span
      ref={anchorRef}
      className={cn("inline-flex max-w-full", className)}
      onMouseEnter={place}
      onMouseLeave={hide}
      onFocus={place}
      onBlur={hide}
      aria-describedby={coords ? tipId : undefined}
    >
      {children}
      {coords
        ? createPortal(
            <span
              ref={tipRef}
              id={tipId}
              role="tooltip"
              style={{
                top: coords.top,
                left: coords.left,
                maxWidth: coords.maxWidth,
                transform:
                  coords.placed === "top"
                    ? "translate(-50%, -100%)"
                    : "translate(-50%, 0)",
              }}
              className={cn(
                "pointer-events-none fixed z-[90] w-max",
                "rounded-md border border-[var(--desk-border-strong)] bg-[var(--desk-tooltip)] px-2.5 py-1.5",
                "shadow-[0_10px_28px_var(--desk-panel-shadow)]",
              )}
            >
              <span className="block text-[0.75rem] leading-snug font-medium break-words whitespace-normal text-[var(--desk-text)]">
                {content}
              </span>
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
