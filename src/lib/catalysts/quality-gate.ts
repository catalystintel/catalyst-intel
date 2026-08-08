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
import { isAccNoMetadataBlob } from "@/lib/catalysts/article-content";
import {
  CATEGORY_PRIORITY,
  GOLD_SUBJECT_SET,
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
  symbol?: string | null;
  headline?: string | null;
  summary?: string | null;
  eventCategory: EventCategoryKey;
  subcategory?: string | null;
  itemCodes?: ParsedItem[] | null;
  timestamp?: string | null;
}

/** @deprecated Use GOLD_SUBJECT_SET from taxonomy — kept for local call sites. */
const GOLD_CATEGORIES = GOLD_SUBJECT_SET;

/**
 * 8-K items that, alone (or only with other members of this set), are not
 * day-trader catalysts — Reg FD / other / exhibits, plus routine paperwork.
 * See docs/research/SEC-8K-FORM4-CLASSIFICATION.md.
 */
const NON_CATALYST_ONLY_CODES = new Set([
  "7.01", // Reg FD
  "8.01", // Other Events (too broad without exhibit signal)
  "9.01", // Exhibits
  "1.04", // Mine safety — statutory, rarely tradeable
  "5.05", // Ethics code amendment — boilerplate governance
  "5.08", // Director nominations — usually procedural
  "5.07", // Shareholder vote results — often routine say-on-pay / annual
]);

/** ClinicalTrials statuses worth a tape row (not "still recruiting"). */
const MATERIAL_CT_STATUSES = new Set([
  "COMPLETED",
  "TERMINATED",
  "SUSPENDED",
  "WITHDRAWN",
  "ACTIVE NOT RECRUITING",
]);

function isNonCatalystOnly8k(
  itemCodes: ParsedItem[] | null | undefined,
): boolean {
  if (!itemCodes || itemCodes.length === 0) return false;
  return itemCodes.every((i) => NON_CATALYST_ONLY_CODES.has(i.code));
}

function hasGoldItem(itemCodes: ParsedItem[] | null | undefined): boolean {
  if (!itemCodes?.length) return false;
  return itemCodes.some((i) => !NON_CATALYST_ONLY_CODES.has(i.code));
}

/**
 * Thin news / disclosure / other may stay only when the row carries
 * investor-usable facts (numbers, catalyst verbs + prose, or gold 8-K items).
 */
export function hasSubstantiveCatalystFacts(item: QualityGateInput): boolean {
  if (hasGoldItem(item.itemCodes)) return true;

  const text = `${item.headline ?? ""} ${item.summary ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
  if (!text || isAccNoMetadataBlob(text)) return false;

  // Explicit quantities / periods from the source.
  if (
    /\$[\d,.]+|\b\d+(\.\d+)?\s*%|\bEPS\b|\bQ[1-4]\b|\bphase\s*[123]\b|\b\d{1,3}(,\d{3})+\b/i.test(
      text,
    )
  ) {
    return true;
  }

  // Real prose with a catalyst verb (not a taxonomy chip).
  if (
    text.length >= 72 &&
    /\b(announc(?:e|ed|es)|report(?:ed|s)?|fil(?:e|ed|es)|approv(?:e|ed|es)|acquir(?:e|ed|es)|rais(?:e|ed|es)|cut|halt(?:ed|s)?|resum(?:e|ed|es)|beat|miss(?:ed|es)?|upgrade[sd]?|downgrade[sd]?)\b/i.test(
      text,
    )
  ) {
    return true;
  }

  return false;
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
  const symbol = item.symbol?.trim() || null;

  // Generic firehose news with no catalyst classification.
  // PR-wire may stay only when it carries real facts (not empty AccNo chrome).
  if (category === "news") {
    if (provider === "pr-wire" || subcategory === "pr_wire") {
      if (!hasSubstantiveCatalystFacts(item)) {
        return {
          decision: "drop",
          reason: "Thin PR-wire / news row — no substantive facts",
        };
      }
    } else {
      return {
        decision: "drop",
        reason: "Generic news firehose — no catalyst classification",
      };
    }
  }

  // Disclosure-only without a higher-signal item (Reg FD / other / exhibits).
  if (category === "disclosure" && !hasGoldItem(item.itemCodes)) {
    return {
      decision: "drop",
      reason:
        "Boilerplate disclosure (7.01/8.01/9.01-only) — no tradeable item",
    };
  }

  // Disclosure / other with a gold item still need readable facts on the tape.
  if (
    (category === "disclosure" || category === "other") &&
    !hasSubstantiveCatalystFacts(item)
  ) {
    return {
      decision: "drop",
      reason: `Thin ${category} row — no substantive extracted facts`,
    };
  }

  if (isNonCatalystOnly8k(item.itemCodes)) {
    return {
      decision: "drop",
      reason:
        "8-K is non-catalyst paperwork only (Reg FD / exhibits / routine items)",
    };
  }

  // Form 4: drop only when ownership XML resolved to routine paperwork
  // (awards / tax withholding / gifts). Unenriched Atom rows stay — the
  // enricher soft-fails under fetch caps; do not discard potentially material
  // buys/sells we have not labeled yet.
  if (
    provider === "sec-edgar" &&
    category === "insider" &&
    (subcategory === "form4_routine" || subcategory === "form4_non_catalyst")
  ) {
    return {
      decision: "drop",
      reason:
        "Form 4 routine ownership paperwork (award/tax/gift) — not an open-market catalyst",
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

  // openFDA / ClinicalTrials without a tradable symbol can't match watchlist
  // or drive alerts — they pollute the tape as orphan rows.
  if ((provider === "openfda" || provider === "clinicaltrials") && !symbol) {
    return {
      decision: "drop",
      reason: "Sponsor unresolved to symbol — unusable for desk filters/alerts",
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

  // Governance / management without symbol is hard to act on (non-SEC).
  if (
    (category === "governance" || category === "management") &&
    !symbol &&
    provider !== "sec-edgar"
  ) {
    return {
      decision: "drop",
      reason: "Governance/management row without symbol",
    };
  }

  // Very low category priority + no symbol = almost always noise.
  const priority = CATEGORY_PRIORITY[category] ?? 0;
  if (priority < 40 && !symbol) {
    return {
      decision: "drop",
      reason: "Low-priority category without symbol",
    };
  }

  return { decision: "keep", reason: "Passed quality gate" };
}

/** Convenience for callers that only need a boolean. */
export function shouldKeepCatalyst(item: QualityGateInput): boolean {
  return evaluateCatalystQuality(item).decision === "keep";
}
