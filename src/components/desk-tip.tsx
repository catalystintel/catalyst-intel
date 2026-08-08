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

type TipSide = "top" | "bottom" | "left" | "right";

const GAP_PX = 8;
const PAD_PX = 10;

function tipTransform(placed: TipSide): string {
  switch (placed) {
    case "top":
      return "translate(-50%, -100%)";
    case "bottom":
      return "translate(-50%, 0)";
    case "left":
      return "translate(-100%, -50%)";
    case "right":
      return "translate(0, -50%)";
  }
}

/**
 * Instant desk-styled hover tip (replaces delayed native `title=` tooltips).
 * Portals so feed rows / sticky headers / the sidebar don't clip it.
 * Clamps to the viewport so edge controls stay fully readable.
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
    const tipClearance = 40;

    let placed: TipSide = side;
    if (placed === "top" && r.top - tipClearance < PAD_PX) {
      placed = "bottom";
    } else if (
      placed === "bottom" &&
      r.bottom + tipClearance > window.innerHeight - PAD_PX
    ) {
      placed = "top";
    } else if (
      placed === "right" &&
      r.right + tipClearance > window.innerWidth - PAD_PX
    ) {
      placed = "left";
    } else if (placed === "left" && r.left - tipClearance < PAD_PX) {
      placed = "right";
    }

    const horizontal = placed === "left" || placed === "right";
    const left = horizontal
      ? placed === "right"
        ? r.right + GAP_PX
        : r.left - GAP_PX
      : r.left + r.width / 2;
    const top = horizontal
      ? r.top + r.height / 2
      : placed === "top"
        ? r.top - GAP_PX
        : r.bottom + GAP_PX;

    setCoords({ top, left, placed, maxWidth });
  }, [content, disabled, side]);

  useLayoutEffect(() => {
    if (!coords || !tipRef.current) return;
    const tipRect = tipRef.current.getBoundingClientRect();
    const horizontal = coords.placed === "left" || coords.placed === "right";

    if (horizontal) {
      const half = tipRect.height / 2;
      const clampedTop = Math.min(
        Math.max(coords.top, PAD_PX + half),
        window.innerHeight - PAD_PX - half,
      );
      let nextLeft = coords.left;
      // Visual left/right after transform — nudge the anchor point if clipped.
      if (tipRect.left < PAD_PX) {
        nextLeft += PAD_PX - tipRect.left;
      } else if (tipRect.right > window.innerWidth - PAD_PX) {
        nextLeft -= tipRect.right - (window.innerWidth - PAD_PX);
      }
      if (
        Math.abs(clampedTop - coords.top) > 0.5 ||
        Math.abs(nextLeft - coords.left) > 0.5
      ) {
        setCoords((prev) =>
          prev ? { ...prev, top: clampedTop, left: nextLeft } : prev,
        );
      }
      return;
    }

    const half = tipRect.width / 2;
    const clampedLeft = Math.min(
      Math.max(coords.left, PAD_PX + half),
      window.innerWidth - PAD_PX - half,
    );
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
                transform: tipTransform(coords.placed),
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
