/**
 * Subject-aware 3–6 line article content (see docs/product/ARTICLE_BY_SUBJECT.md).
 * Fills slots from extracted keyFacts + grounded summary sentences only —
 * never invents numbers.
 */

import { deriveTakeaways } from "@/lib/catalysts/article-funnel";
import {
  isAccNoMetadataBlob,
  stripHtml,
} from "@/lib/catalysts/article-content";
import {
  isEventCategoryKey,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";

export interface SubjectArticleFact {
  label: string;
  value: string;
}

export interface SubjectArticleInput {
  eventCategory?: string | null;
  summary?: string | null;
  body?: string | null;
  headline?: string | null;
  title?: string | null;
  keyFacts?: SubjectArticleFact[] | null;
  companyName?: string | null;
  symbol?: string | null;
  /** Soft max lines (clamped to 3–6). */
  maxLines?: number;
}

/** Per-subject fact-label preferences (case-insensitive substring match). */
const SUBJECT_FACT_SLOTS: Record<EventCategoryKey, string[]> = {
  earnings: ["eps", "revenue", "sales", "guidance", "surprise", "quarter"],
  deals: [
    "buyer",
    "target",
    "value",
    "deal",
    "consideration",
    "status",
    "close",
  ],
  management: [
    "officer",
    "role",
    "position",
    "appointment",
    "departure",
    "name",
  ],
  capital: [
    "amount",
    "size",
    "offering",
    "shares",
    "proceeds",
    "instrument",
    "notes",
  ],
  distress: ["bankruptcy", "delist", "covenant", "deadline", "amount", "risk"],
  restructuring: [
    "charge",
    "headcount",
    "severance",
    "savings",
    "sites",
    "exit",
  ],
  governance: ["auditor", "vote", "control", "board", "effective"],
  disclosure: ["event", "item", "fact"],
  trading_halt: ["reason", "halt", "resume", "exchange", "status"],
  insider: [
    "shares",
    "value",
    "role",
    "transaction",
    "ownership",
    "buy",
    "sell",
  ],
  regulatory: ["fda", "agency", "product", "indication", "outcome", "approval"],
  clinical: ["phase", "status", "condition", "endpoint", "trial", "result"],
  macro: ["actual", "estimate", "prior", "print", "rate", "decision"],
  analyst: ["firm", "rating", "target", "pt", "action", "upgrade", "downgrade"],
  cyber: ["incident", "impact", "system", "data", "timing"],
  news: ["event", "impact", "detail"],
  other: ["event", "fact", "detail"],
};

const WHY_PREFIX: Partial<Record<EventCategoryKey, string>> = {
  earnings: "Earnings print — traders reprice on beat/miss and guidance.",
  deals: "M&A can reprice both sides on value, certainty, and timing.",
  management:
    "Leadership changes can shift strategy and near-term execution risk.",
  capital:
    "Capital-markets supply or leverage can move the stock around the print.",
  distress: "Distress / listing risk is high-urgency for equity holders.",
  restructuring:
    "Restructuring charges and cuts signal cost reset and near-term noise.",
  governance:
    "Governance changes can affect controls, audits, or ownership rights.",
  disclosure: "Material disclosure — act only on facts stated in the filing.",
  trading_halt:
    "Trading halt freezes liquidity until the exchange resumes the name.",
  insider: "Open-market insider flow is a high-signal ownership clue.",
  regulatory: "Regulatory outcomes can gate revenue and binary biotech moves.",
  clinical: "Clinical readouts can binary-move biotech names.",
  macro: "Macro prints reset rates, risk appetite, and sector betas.",
  analyst: "Street rating / PT changes can move flows into the session.",
  cyber: "Material cyber incidents can hit operations, liability, and trust.",
  news: "Company news — weigh only facts in the story.",
  other: "Event tape — use only disclosed facts.",
};

function clampMax(max?: number): number {
  if (typeof max !== "number" || !Number.isFinite(max)) return 6;
  return Math.min(6, Math.max(3, Math.trunc(max)));
}

function categoryOf(value?: string | null): EventCategoryKey {
  if (value && isEventCategoryKey(value)) return value;
  return "other";
}

function factLine(fact: SubjectArticleFact): string {
  const label = fact.label.replace(/\s+/g, " ").trim();
  const value = fact.value.replace(/\s+/g, " ").trim();
  if (!label) return value;
  if (!value) return label;
  return `${label}: ${value}`;
}

function pickFactLines(
  facts: SubjectArticleFact[],
  slots: string[],
  limit: number,
): string[] {
  if (facts.length === 0 || limit <= 0) return [];
  const used = new Set<number>();
  const out: string[] = [];

  for (const slot of slots) {
    if (out.length >= limit) break;
    const idx = facts.findIndex(
      (f, i) =>
        !used.has(i) &&
        `${f.label} ${f.value}`.toLowerCase().includes(slot.toLowerCase()),
    );
    if (idx < 0) continue;
    used.add(idx);
    out.push(factLine(facts[idx]));
  }

  // Fill remaining slots with unused facts in order.
  for (let i = 0; i < facts.length && out.length < limit; i++) {
    if (used.has(i)) continue;
    used.add(i);
    out.push(factLine(facts[i]));
  }
  return out;
}

function whyLine(
  category: EventCategoryKey,
  input: SubjectArticleInput,
): string {
  const company =
    input.companyName?.replace(/\s+/g, " ").trim() ||
    input.symbol?.trim().toUpperCase() ||
    null;
  const base = WHY_PREFIX[category] ?? WHY_PREFIX.other!;
  if (!company) return base;
  // Keep why-it-matters short and subject-distinct; company anchors the line.
  return `${company}: ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
}

function groundedSentenceLines(
  summary?: string | null,
  body?: string | null,
  max = 4,
): string[] {
  return deriveTakeaways(summary, body, max).filter(
    (line) => line && !isAccNoMetadataBlob(line),
  );
}

/**
 * Build 3–6 short content lines for the split / Details triage block.
 * Prefer keyFacts slotted by subject; fall back to grounded summary sentences.
 */
export function buildSubjectArticleLines(input: SubjectArticleInput): string[] {
  const max = clampMax(input.maxLines);
  const category = categoryOf(input.eventCategory);
  const facts = (input.keyFacts ?? [])
    .map((f) => ({
      label: f.label?.replace(/\s+/g, " ").trim() ?? "",
      value: f.value?.replace(/\s+/g, " ").trim() ?? "",
    }))
    .filter((f) => f.label && f.value && !isAccNoMetadataBlob(f.value));

  const lines: string[] = [];
  lines.push(whyLine(category, input));

  const factBudget = Math.max(1, max - 1);
  const fromFacts = pickFactLines(
    facts,
    SUBJECT_FACT_SLOTS[category] ?? SUBJECT_FACT_SLOTS.other,
    factBudget,
  );
  lines.push(...fromFacts);

  if (lines.length < 3) {
    const need = Math.min(max - lines.length, 6);
    const fromText = groundedSentenceLines(input.summary, input.body, need + 1);
    for (const s of fromText) {
      if (lines.length >= max) break;
      // Avoid duplicating the why-line / fact lines.
      const lower = s.toLowerCase();
      if (lines.some((l) => l.toLowerCase() === lower)) continue;
      lines.push(s.length > 160 ? `${s.slice(0, 157).trim()}…` : s);
    }
  }

  // Still thin — pull a headline/title as a last grounded line (not AccNo).
  if (lines.length < 3) {
    for (const raw of [input.headline, input.title, input.summary]) {
      if (lines.length >= 3) break;
      const t = raw?.trim() ? stripHtml(raw) : "";
      if (!t || t.length < 12 || isAccNoMetadataBlob(t)) continue;
      const line = t.length > 160 ? `${t.slice(0, 157).trim()}…` : t;
      if (lines.some((l) => l.toLowerCase() === line.toLowerCase())) continue;
      lines.push(line);
    }
  }

  // Enforce 3–6: pad is not allowed with invented copy — return what we have
  // (callers may show fewer). Cap at max.
  return lines.slice(0, max);
}

/**
 * Convenience for UI: subject lines when rich enough, else classic takeaways.
 */
export function deriveSubjectTakeaways(input: SubjectArticleInput): string[] {
  const subjectLines = buildSubjectArticleLines(input);
  if (subjectLines.length >= 3) return subjectLines;
  const classic = deriveTakeaways(
    input.summary,
    input.body,
    clampMax(input.maxLines),
  );
  if (classic.length >= subjectLines.length) return classic;
  return subjectLines.length > 0 ? subjectLines : classic;
}
