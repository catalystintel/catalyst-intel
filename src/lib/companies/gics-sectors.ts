/**
 * GICS Level-1 sectors + Finnhub industry → GICS normalization.
 * Live-tape industry filters and `companies.sector` use these labels.
 */

export const GICS_SECTOR_KEYS = [
  "energy",
  "materials",
  "industrials",
  "consumer_discretionary",
  "consumer_staples",
  "health_care",
  "financials",
  "information_technology",
  "communication_services",
  "utilities",
  "real_estate",
] as const;

export type GicsSectorKey = (typeof GICS_SECTOR_KEYS)[number];

export const GICS_SECTOR_LABELS: Record<GicsSectorKey, string> = {
  energy: "Energy",
  materials: "Materials",
  industrials: "Industrials",
  consumer_discretionary: "Consumer Discretionary",
  consumer_staples: "Consumer Staples",
  health_care: "Health Care",
  financials: "Financials",
  information_technology: "Information Technology",
  communication_services: "Communication Services",
  utilities: "Utilities",
  real_estate: "Real Estate",
};

const LABEL_TO_KEY = new Map(
  Object.entries(GICS_SECTOR_LABELS).map(([key, label]) => [
    label.toLowerCase(),
    key as GicsSectorKey,
  ]),
);

/** Common Finnhub `finnhubIndustry` (and aliases) → GICS L1. */
const FINNHUB_TO_GICS: Record<string, GicsSectorKey> = {
  technology: "information_technology",
  tech: "information_technology",
  "information technology": "information_technology",
  software: "information_technology",
  semiconductors: "information_technology",
  "health care": "health_care",
  healthcare: "health_care",
  biotechnology: "health_care",
  pharmaceuticals: "health_care",
  "life sciences": "health_care",
  financial: "financials",
  financials: "financials",
  finance: "financials",
  banking: "financials",
  banks: "financials",
  insurance: "financials",
  energy: "energy",
  "oil & gas": "energy",
  "oil and gas": "energy",
  materials: "materials",
  "basic materials": "materials",
  mining: "materials",
  chemicals: "materials",
  industrials: "industrials",
  industrial: "industrials",
  "aerospace & defense": "industrials",
  "consumer cyclical": "consumer_discretionary",
  "consumer discretionary": "consumer_discretionary",
  retail: "consumer_discretionary",
  automotive: "consumer_discretionary",
  "consumer defensive": "consumer_staples",
  "consumer staples": "consumer_staples",
  "food & beverage": "consumer_staples",
  "communication services": "communication_services",
  "media & entertainment": "communication_services",
  telecom: "communication_services",
  telecommunications: "communication_services",
  utilities: "utilities",
  "real estate": "real_estate",
  reits: "real_estate",
};

export function isGicsSectorKey(value: string): value is GicsSectorKey {
  return (GICS_SECTOR_KEYS as readonly string[]).includes(value);
}

export function gicsLabel(key: GicsSectorKey): string {
  return GICS_SECTOR_LABELS[key];
}

/**
 * Maps a vendor / stored sector string to a GICS L1 key.
 * Empty, N/A, and unknown values return null (unmapped — no invented bucket).
 */
export function normalizeToGics(
  raw: string | null | undefined,
): GicsSectorKey | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower === "n/a" || lower === "na" || lower === "none" || lower === "-") {
    return null;
  }
  if (isGicsSectorKey(lower)) return lower;
  const fromLabel = LABEL_TO_KEY.get(lower);
  if (fromLabel) return fromLabel;
  if (FINNHUB_TO_GICS[lower]) return FINNHUB_TO_GICS[lower];
  return null;
}

/** Canonical label for storage / display, or null if unmapped. */
export function normalizeToGicsLabel(
  raw: string | null | undefined,
): string | null {
  const key = normalizeToGics(raw);
  return key ? GICS_SECTOR_LABELS[key] : null;
}
