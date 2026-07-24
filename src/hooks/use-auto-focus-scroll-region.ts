import { useEffect, type RefObject } from "react";

/**
 * Page Up / Page Down / Home / End only scroll the browser's current focus
 * target (or its nearest scrollable ancestor). Landing on a page with focus
 * sitting on `<body>` - the common case right after navigation, before the
 * user has clicked anything - means those keys have nothing to scroll,
 * since our scrollable regions are nested `overflow-auto` containers, not
 * the document itself.
 *
 * Focusing the scroll region on mount (without adding it to the Tab order)
 * makes native Page Up/Down/Home/End work immediately. Skips stealing focus
 * if something more specific already grabbed it first (e.g. a filter input
 * that autofocuses, or another scroll region mounted lower in the tree).
 */
export function useAutoFocusScrollRegion(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (document.activeElement === document.body) {
      ref.current?.focus({ preventScroll: true });
    }
  }, [ref]);
}
