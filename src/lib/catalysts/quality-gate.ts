/**
 * Quality gate — prefer fewer gold rows over spam volume.
 *
 * Product priority (see Client-Target-Guideline): stay in the catalyst
 * decision lane. Firehose news, stale consensus, unresolved sponsors, and
 * boilerplate 8-Ks waste the tape and train users to ignore alerts.
 *
 * Applied at ingest (`ingestNormalizedCatalysts`) so every source shares one
 * policy. Sources may also pre-filter, but the gate is the last line of defense.
 */

import type { ParsedItem } from "@/lib/jobs/parse-8k-items";
import { RETENTION_DAYS } from "@/lib/jobs/data-retention";
import {
  CATEGORY_PRIORITY,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";

export type QualityDecision = "keep" | "drop";

export interface QualityVerdict {
  decision: QualityDecision;
  reason: string;
}

/** Minimal shape needed to score quality — avoids circular import with ingest. */
export interface QualityGateInput {
  provider: string;
  ticker?: string | null;
  headline?: string | null;
  summary?: string | null;
  eventCategory: EventCategoryKey;
  subcategory?: string | null;
  itemCodes?: ParsedItem[] | null;
  timestamp?: string | null;
}

/** Categories that are never "thin news" — they are the desk's job. */
const GOLD_CATEGORIES = new Set<EventCategoryKey>([
  "distress",
  "trading_halt",
  "cyber",
  "earnings",
  "regulatory",
  "deals",
  "macro",
  "clinical",
  "restructuring",
  "capital",
]);

/** 8-K items that, alone, are almost never tradeable on their own. */
const BOILERPLATE_ONLY_CODES = new Set(["7.01", "8.01", "9.01"]);

/** ClinicalTrials statuses worth a tape row (not "still recruiting"). */
const MATERIAL_CT_STATUSES = new Set([
  "COMPLETED",
  "TERMINATED",
  "SUSPENDED",
  "WITHDRAWN",
  "ACTIVE NOT RECRUITING",
]);

function isBoilerplateOnly8k(
  itemCodes: ParsedItem[] | null | undefined,
): boolean {
  if (!itemCodes || itemCodes.length === 0) return false;
  return itemCodes.every((i) => BOILERPLATE_ONLY_CODES.has(i.code));
}

function hasGoldItem(itemCodes: ParsedItem[] | null | undefined): boolean {
  if (!itemCodes?.length) return false;
  return itemCodes.some((i) => !BOILERPLATE_ONLY_CODES.has(i.code));
}

/**
 * Decide whether a normalized catalyst is gold enough for the Live tape.
 * Fail closed on thin news / unresolved entities / boilerplate filings.
 */
export function evaluateCatalystQuality(
  item: QualityGateInput,
): QualityVerdict {
  const category = item.eventCategory;
  const subcategory = item.subcategory?.toLowerCase() ?? "";
  const provider = item.provider.toLowerCase();
  const ticker = item.ticker?.trim() || null;

  // Generic firehose news with no catalyst classification.
  if (category === "news") {
    return {
      decision: "drop",
      reason: "Generic news firehose — no catalyst classification",
    };
  }

  // Disclosure-only without a higher-signal item (Reg FD / other / exhibits).
  if (category === "disclosure" && !hasGoldItem(item.itemCodes)) {
    return {
      decision: "drop",
      reason:
        "Boilerplate disclosure (7.01/8.01/9.01-only) — no tradeable item",
    };
  }

  if (isBoilerplateOnly8k(item.itemCodes)) {
    return {
      decision: "drop",
      reason: "8-K is exhibits/Reg FD only — drop noise",
    };
  }

  // Finnhub consensus trend snapshots are not events.
  if (provider === "finnhub" && subcategory === "recommendation_trend") {
    return {
      decision: "drop",
      reason: "Stale analyst consensus snapshot — not a catalyst event",
    };
  }

  // Finnhub price-target rows: keep only when timestamp is recent (within retention).
  if (provider === "finnhub" && subcategory === "price_target") {
    const ts = item.timestamp?.trim();
    if (!ts) {
      return {
        decision: "drop",
        reason: "Price target without timestamp — stale snapshot",
      };
    }
    const parsed = new Date(ts);
    if (Number.isNaN(parsed.getTime())) {
      return {
        decision: "drop",
        reason: "Price target timestamp unparseable",
      };
    }
    const maxAgeMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - parsed.getTime() > maxAgeMs) {
      return {
        decision: "drop",
        reason: `Price target older than ${RETENTION_DAYS}d retention`,
      };
    }
  }

  // Unclassified vendor news.
  if (
    (provider === "finnhub" || provider === "polygon") &&
    category === "other"
  ) {
    return {
      decision: "drop",
      reason: "Unclassified vendor news — not catalyst gold",
    };
  }

  // Polygon non-wire: only gold-classified (or Benzinga wire) survives.
  if (provider === "polygon" && subcategory !== "benzinga_wire") {
    if (!GOLD_CATEGORIES.has(category) && category !== "analyst") {
      return {
        decision: "drop",
        reason: "Non-wire Polygon article without catalyst category",
      };
    }
  }

  // openFDA / ClinicalTrials without a tradable ticker can't match watchlist
  // or drive alerts — they pollute the tape as orphan rows.
  if ((provider === "openfda" || provider === "clinicaltrials") && !ticker) {
    return {
      decision: "drop",
      reason: "Sponsor unresolved to ticker — unusable for desk filters/alerts",
    };
  }

  // openFDA: labeling supplements without ORIG are usually not tradeable.
  if (provider === "openfda" && subcategory === "openfda_approval") {
    const summary = (item.summary ?? "").toUpperCase();
    const headline = (item.headline ?? "").toLowerCase();
    const isOrig =
      headline.includes("original approval") || summary.includes("ORIG");
    if (!isOrig && summary.includes("SUPPL")) {
      return {
        decision: "drop",
        reason: "openFDA supplement/labeling update — not an original approval",
      };
    }
  }

  // ClinicalTrials: recruiting noise is the default feed; only material statuses.
  if (provider === "clinicaltrials") {
    const status = (item.headline ?? "")
      .trim()
      .toUpperCase()
      .replace(/_/g, " ");
    const material = [...MATERIAL_CT_STATUSES].some(
      (s) => status === s || status.includes(s),
    );
    if (!material) {
      return {
        decision: "drop",
        reason: `Clinical trial status "${item.headline}" is not material`,
      };
    }
  }

  // Form4API duplicates EDGAR Form 4 Atom — skip to cut double volume.
  if (provider === "form4api") {
    return {
      decision: "drop",
      reason: "Duplicate of SEC EDGAR Form 4 — skip optional Form4API rows",
    };
  }

  // Governance / management without ticker is hard to act on (non-SEC).
  if (
    (category === "governance" || category === "management") &&
    !ticker &&
    provider !== "sec-edgar"
  ) {
    return {
      decision: "drop",
      reason: "Governance/management row without ticker",
    };
  }

  // Very low category priority + no ticker = almost always noise.
  const priority = CATEGORY_PRIORITY[category] ?? 0;
  if (priority < 40 && !ticker) {
    return {
      decision: "drop",
      reason: "Low-priority category without ticker",
    };
  }

  return { decision: "keep", reason: "Passed quality gate" };
}

/** Convenience for callers that only need a boolean. */
export function shouldKeepCatalyst(item: QualityGateInput): boolean {
  return evaluateCatalystQuality(item).decision === "keep";
}
