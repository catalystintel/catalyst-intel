/**
 * Reconcile session change % from price + previous close.
 *
 * Vendor `dp` / open→close shortcuts sometimes report hundreds of percent
 * on a quiet day (stale previousClose after reverse splits, wrong share
 * class, etc.). Prefer recomputing from price vs previousClose, and drop
 * absurd session moves rather than paint fake green/red.
 */

export type SessionMove = {
  change: number | null;
  changePercent: number | null;
};

/** Session moves beyond this are treated as bad vendor data, not real tape. */
export const MAX_PLAUSIBLE_SESSION_PCT = 200;

export function sessionMoveFromPreviousClose(
  price: number | null | undefined,
  previousClose: number | null | undefined,
): SessionMove {
  if (
    price == null ||
    previousClose == null ||
    !Number.isFinite(price) ||
    !Number.isFinite(previousClose) ||
    previousClose === 0 ||
    price <= 0
  ) {
    return { change: null, changePercent: null };
  }
  const change = price - previousClose;
  const changePercent = (change / previousClose) * 100;
  if (!Number.isFinite(changePercent)) {
    return { change: null, changePercent: null };
  }
  if (Math.abs(changePercent) > MAX_PLAUSIBLE_SESSION_PCT) {
    return { change: null, changePercent: null };
  }
  return {
    change: Number(change.toFixed(4)),
    changePercent: Number(changePercent.toFixed(3)),
  };
}

/**
 * Prefer previous-close math. If vendor % wildly disagrees with recomputed
 * (or is absurd while price sits near the session open), drop the %.
 */
export function reconcileSessionMove(options: {
  price: number | null | undefined;
  previousClose: number | null | undefined;
  open?: number | null | undefined;
  vendorChange?: number | null | undefined;
  vendorChangePercent?: number | null | undefined;
}): SessionMove {
  const fromPc = sessionMoveFromPreviousClose(
    options.price,
    options.previousClose,
  );
  if (fromPc.changePercent != null) {
    const vendorPct = options.vendorChangePercent;
    if (
      vendorPct != null &&
      Number.isFinite(vendorPct) &&
      Math.abs(vendorPct - fromPc.changePercent) <= 1.5
    ) {
      // Vendor agrees — keep recomputed (consistent rounding).
      return fromPc;
    }
    return fromPc;
  }

  const price = options.price;
  const open = options.open;
  if (
    price != null &&
    open != null &&
    Number.isFinite(price) &&
    Number.isFinite(open) &&
    open > 0 &&
    options.vendorChangePercent != null &&
    Math.abs(options.vendorChangePercent) > MAX_PLAUSIBLE_SESSION_PCT
  ) {
    // Vendor claims a huge move but we have no trustworthy previous close —
    // do not surface hundreds of % from a broken pc.
    return { change: null, changePercent: null };
  }

  const vendorChange = options.vendorChange;
  const vendorPct = options.vendorChangePercent;
  if (
    vendorPct != null &&
    Number.isFinite(vendorPct) &&
    Math.abs(vendorPct) <= MAX_PLAUSIBLE_SESSION_PCT
  ) {
    return {
      change:
        vendorChange != null && Number.isFinite(vendorChange)
          ? Number(vendorChange.toFixed(4))
          : null,
      changePercent: Number(vendorPct.toFixed(3)),
    };
  }

  return { change: null, changePercent: null };
}
