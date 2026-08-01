import type { WatchlistCriteria } from "@/db/schema";

export interface WatchlistTemplate {
  id: string;
  name: string;
  description: string;
  criteria: WatchlistCriteria;
}

/**
 * Curated starting points for the watchlist builder — one click drops a
 * ready-to-edit rule into the draft (manual fields + AI prompt both still
 * apply on top). Each pairs structured axes (categories/forms) with the
 * matching auto-tag namespace (see `deriveAutoTags` in ingest-pipeline.ts)
 * so results are precise without the user knowing the tag vocabulary.
 */
export const WATCHLIST_TEMPLATES: WatchlistTemplate[] = [
  {
    id: "material-8k",
    name: "Material 8-K filings",
    description:
      "Any SEC 8-K current report — M&A, management, capital, disclosure.",
    criteria: { forms: ["8-K"] },
  },
  {
    id: "fda-regulatory",
    name: "FDA & regulatory catalysts",
    description:
      "Clinical / regulatory events — trial readouts, approvals, PDUFA.",
    criteria: { categories: ["clinical", "regulatory"], tags: ["fda"] },
  },
  {
    id: "trading-halts",
    name: "Trading halts",
    description: "Exchange halts and resumptions — volatility / news pending.",
    criteria: { categories: ["trading_halt"] },
  },
  {
    id: "insider-buying",
    name: "Insider Form 4 buying",
    description: "Insider transactions filed on Form 4 — direction unfiltered.",
    criteria: { forms: ["4"], categories: ["insider"] },
  },
  {
    id: "ma-deals",
    name: "M&A / deals",
    description: "Mergers, acquisitions, and 13D/13G ownership stakes.",
    criteria: { categories: ["deals"], tags: ["ma"] },
  },
  {
    id: "ah-pm-bombs",
    name: "AH / PM high-impact bombs",
    description: "High-materiality events posted after-hours or pre-market.",
    criteria: { tags: ["impact:high", "session:ah"] },
  },
  {
    id: "earnings-surprises",
    name: "Earnings watch",
    description: "Earnings prints and reactions, high materiality only.",
    criteria: { categories: ["earnings"], tags: ["impact:high"] },
  },
  {
    id: "analyst-actions",
    name: "Analyst actions",
    description: "Upgrades, downgrades, and price-target changes.",
    criteria: { categories: ["analyst"] },
  },
  {
    id: "distress-restructuring",
    name: "Distress & restructuring",
    description: "Bankruptcy, going-concern, and restructuring catalysts.",
    criteria: { categories: ["distress", "restructuring"] },
  },
  {
    id: "capital-raises",
    name: "Capital raises / dilution",
    description: "Shelf registrations, secondary offerings, and 424B pricing.",
    criteria: { forms: ["424B", "S-3"], categories: ["capital"] },
  },
];
