/**
 * Vendor-source desk controls (Source facet filter, outbound proof links)
 * are local-development only. Deployed users should treat Catalyst Intel as
 * the product source of truth — not EDGAR / Nasdaq / wire vendors.
 *
 * Gated on `NODE_ENV === "development"` so preview/staging/production builds
 * never ship these controls (even for admins).
 */
export function isLocalDevUi(): boolean {
  return process.env.NODE_ENV === "development";
}

/** Short badge copy for local-only controls in the desk UI. */
export const LOCAL_DEV_ONLY_LABEL = "(only in dev)";
