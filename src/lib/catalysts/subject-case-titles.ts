/**
 * Subject-case title engine for financing, M&A, partnership, regulatory, and clinical.
 * Flow: identify primary subject → select case → fill template with verified facts only.
 * Other taxonomy subjects stay on the legacy builders in subject-titles.ts.
 */

import type {
  SubjectTitleFact,
  SubjectTitleInput,
} from "@/lib/catalysts/subject-titles";
import { resolveDisplayCompanyName } from "@/lib/catalysts/catalyst-titles";

export type EngineSubject =
  "financing" | "ma" | "regulatory" | "partnership" | "clinical";

export type FinancingCase = "F1" | "F2" | "F3" | "F4" | "F5" | "F6";
/** M&A title scenarios — templates in fillMa; never invent Buyer/Target/$/premium. */
export type MaCase =
  | "M1" // Agrees to Acquire Target for $XM
  | "M2" // to Acquire Target for $X/Share
  | "M3" // to Acquire Target in $XM Deal
  | "M4" // Announces Acquisition of Target
  | "M5" // Agrees to Acquire Target
  | "M6" // Completes Acquisition of Target
  | "M7" // Agrees to Merge With Target
  | "M8" // Proposes Acquisition of Target
  | "M9" // Explores Acquisition of Target
  | "M10" // Launches Takeover of Target for $X/Share
  | "M11" // to Acquire Business/Asset for $XM
  | "M12" // Acquires Business/Asset for $XM
  | "M13" // Enters Definitive Agreement to Acquire Target
  | "M14" // Agrees to Buy Target for $X/Share
  | "M15" // to Acquire Target in All-Stock Deal
  | "M16" // to Acquire Target in Cash-and-Stock Deal
  | "M17" // Agrees to Acquire Target at X% Premium
  | "M18" // Completes $XM Acquisition of Target
  | "M19" // Announces $XM Acquisition of Target
  | "M20"; // Terminates Acquisition of Target (status)
export type RegulatoryCase = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7";
export type PartnershipCase = "P1" | "P2" | "P3" | "P4" | "P5" | "P6";
export type ClinicalCase = "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7";

export type SubjectCase =
  FinancingCase | MaCase | RegulatoryCase | PartnershipCase | ClinicalCase;

function normalizeWs(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function companyOf(input: SubjectTitleInput): string {
  return resolveDisplayCompanyName(input.companyName, input.symbol);
}

function factMap(facts: SubjectTitleFact[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of facts) {
    const label = normalizeWs(f.label ?? "");
    const value = normalizeWs(f.value ?? "");
    if (!label || !value) continue;
    map.set(label.toLowerCase(), value);
  }
  return map;
}

function findLabeled(
  map: Map<string, string>,
  ...needles: string[]
): string | null {
  for (const needle of needles) {
    const lower = needle.toLowerCase();
    for (const [label, value] of map) {
      if (label === lower || label.includes(lower)) return value;
    }
  }
  for (const [label, value] of map) {
    const hay = `${label} ${value}`.toLowerCase();
    if (needles.some((n) => hay.includes(n.toLowerCase()))) return value;
  }
  return null;
}

function cueText(input: SubjectTitleInput, map: Map<string, string>): string {
  const bits = [...map.entries()].map(([k, v]) => `${k} ${v}`);
  const items = (input.items ?? []).flatMap((i) => [
    i.code ?? "",
    i.label ?? "",
  ]);
  return normalizeWs(
    [
      ...bits,
      ...items,
      input.type ?? "",
      input.subcategory ?? "",
      input.eventCategory ?? "",
      input.title ?? "",
      input.headline ?? "",
      input.summary ?? "",
    ].join(" "),
  );
}

/** Normalize "$500 million" → "$500M" when possible; else keep source phrasing. */
function compactMoney(raw: string | null | undefined): string | null {
  const t = normalizeWs(raw ?? "");
  if (!t) return null;
  const m = t.match(/\$?\s*([\d,.]+)\s*(million|billion|mm|bn|m|b)?\b/i);
  if (!m) {
    return /\$/.test(t) ? t : null;
  }
  const num = m[1]!.replace(/,/g, "");
  const unit = (m[2] ?? "").toLowerCase();
  if (unit.startsWith("b") || unit === "bn") return `$${num}B`;
  if (unit.startsWith("m") || unit === "mm" || unit === "") {
    // Bare number with $ already: keep as $XM when source said million/M
    if (unit === "" && /\$/.test(t) && !/million|billion|mm|bn/i.test(t)) {
      return `$${num}`;
    }
    return `$${num}M`;
  }
  return t.startsWith("$") ? t : `$${t}`;
}

function extractMoney(cue: string, map: Map<string, string>): string | null {
  const fromFact =
    findLabeled(map, "amount", "deal value", "value", "proceeds", "size") ??
    null;
  return (
    compactMoney(fromFact) ||
    compactMoney(
      cue.match(/\$[\d.,]+\s*(?:million|billion|mm|bn|[mb])?\b/i)?.[0],
    )
  );
}

function extractSharePrice(
  cue: string,
  map: Map<string, string>,
): string | null {
  const fromFact = findLabeled(map, "price", "offer price", "share price");
  if (fromFact && /\$/.test(fromFact)) {
    const m = fromFact.match(/\$[\d.]+/);
    return m ? `${m[0]}/Share` : null;
  }
  const m = cue.match(/\$[\d.]+(?:\s*per\s*share|\/\s*share|\/share)/i);
  if (m) {
    const dollars = m[0].match(/\$[\d.]+/)?.[0];
    return dollars ? `${dollars}/Share` : null;
  }
  return null;
}

function extractShareCount(
  cue: string,
  map: Map<string, string>,
): string | null {
  const fromFact = findLabeled(map, "shares");
  if (fromFact) {
    const m = fromFact.match(/([\d,.]+)\s*(?:million\s+)?(?:shares?|sh)?/i);
    if (m)
      return `${m[1]!.replace(/,/g, "")}M-Share`.replace(/MM-Share/, "M-Share");
  }
  const m = cue.match(/([\d,.]+)\s*million\s+shares?/i);
  if (m) return `${m[1]!.replace(/,/g, "")}M-Share`;
  return null;
}

function extractPhase(cue: string, map: Map<string, string>): string | null {
  const fromFact = findLabeled(map, "phase");
  if (fromFact) {
    const m = fromFact.match(/([123ivx]+)/i);
    return m ? m[1]!.toUpperCase() : null;
  }
  const m = cue.match(/\bphase\s*([123ivx]+)\b/i);
  return m ? m[1]!.toUpperCase() : null;
}

function extractProduct(map: Map<string, string>, cue: string): string | null {
  return (
    findLabeled(
      map,
      "product",
      "drug",
      "therapy",
      "candidate",
      "device",
      "program",
    ) ||
    cue.match(/\b(?:drug|therapy|candidate)\s+([A-Z][A-Za-z0-9\-]+)/)?.[1] ||
    null
  );
}

function extractPartner(map: Map<string, string>): string | null {
  const raw = findLabeled(
    map,
    "partner",
    "counterparty",
    "collaborator",
    "licensee",
    "licensor",
  );
  if (!raw) return null;
  if (
    /^(?:partnership|collaboration|license|licence|licensing|agreement|deal|contract|strategic\s+partnership)$/i.test(
      raw,
    )
  ) {
    return null;
  }
  return raw;
}

function extractTarget(map: Map<string, string>): string | null {
  return findLabeled(map, "target", "seller", "acquired company");
}

function extractBuyer(map: Map<string, string>, company: string): string {
  return findLabeled(map, "buyer", "acquirer", "acquiring company") || company;
}

/** Division / asset / business line (not a whole-company Target). */
function extractAsset(map: Map<string, string>, cue: string): string | null {
  const fromFact = findLabeled(
    map,
    "asset",
    "business",
    "division",
    "unit",
    "brand",
  );
  if (fromFact) return fromFact;
  const m = cue.match(
    /\b(?:acquire|acquires|acquiring|acquisition of)\s+(?:the\s+)?([A-Z][^.]{2,60}?)\s+(?:business|division|assets?|unit|brand)\b/i,
  );
  return m ? normalizeWs(m[1]!) : null;
}

function extractPremiumPct(
  cue: string,
  map: Map<string, string>,
): string | null {
  const fromFact = findLabeled(map, "premium");
  if (fromFact) {
    const m = fromFact.match(/(\d+(?:\.\d+)?)\s*%/);
    if (m) return `${m[1]}%`;
  }
  const m = cue.match(
    /(\d+(?:\.\d+)?)\s*%\s*premium\b|\bpremium\s+of\s+(\d+(?:\.\d+)?)\s*%/i,
  );
  if (!m) return null;
  return `${m[1] || m[2]}%`;
}

function isAllStock(cue: string, map: Map<string, string>): boolean {
  const consideration =
    findLabeled(map, "consideration", "structure", "deal type") ?? "";
  return /\ball[-\s]?stock\b/i.test(`${consideration} ${cue}`);
}

function isCashAndStock(cue: string, map: Map<string, string>): boolean {
  const consideration =
    findLabeled(map, "consideration", "structure", "deal type") ?? "";
  return /\bcash[-\s]?and[-\s]?stock\b|\bcash\s+and\s+stock\b/i.test(
    `${consideration} ${cue}`,
  );
}

function extractRegulator(cue: string, map: Map<string, string>): string {
  const fromFact = findLabeled(map, "agency", "regulator", "fda");
  if (fromFact) {
    if (/fda/i.test(fromFact)) return "FDA";
    if (/ema/i.test(fromFact)) return "EMA";
    if (/sec\b/i.test(fromFact)) return "SEC";
    if (/ftc/i.test(fromFact)) return "FTC";
    if (/doj/i.test(fromFact)) return "DOJ";
    return fromFact;
  }
  if (/\bFDA\b/i.test(cue)) return "FDA";
  if (/\bEMA\b/i.test(cue)) return "EMA";
  if (/\bSEC\b/i.test(cue)) return "SEC";
  if (/\bFTC\b/i.test(cue)) return "FTC";
  if (/\bDOJ\b/i.test(cue)) return "DOJ";
  return "FDA";
}

function extractPct(cue: string, map: Map<string, string>): string | null {
  const fromFact = findLabeled(map, "improvement", "reduction", "result", "%");
  if (fromFact) {
    const m = fromFact.match(/(\d+(?:\.\d+)?)\s*%/);
    if (m) return `${m[1]}%`;
  }
  const m = cue.match(
    /(\d+(?:\.\d+)?)\s*%\s*(?:improvement|reduction|increase|decrease)?/i,
  );
  return m ? `${m[1]}%` : null;
}

// --- Primary subject identification (event-aware, not keyword soup) ---

function scoreFinancing(cue: string, input: SubjectTitleInput): number {
  let s = 0;
  if (input.eventCategory === "capital") s += 4;
  if (/^S-3|^424B/i.test(input.type ?? "")) s += 5;
  if (
    /\b(?:registered direct|public offering|follow-?on|private placement|at-the-market|\bATM\b|shelf|equity offering|credit facility|debt financing|priced.{0,20}offering)\b/i.test(
      cue,
    )
  ) {
    s += 5;
  }
  if (
    /\$[\d.,]+/.test(cue) &&
    /\b(?:offering|financing|placement|facility|notes)\b/i.test(cue)
  ) {
    s += 2;
  }
  return s;
}

function scoreMa(cue: string, input: SubjectTitleInput): number {
  let s = 0;
  if (input.eventCategory === "deals") s += 2;
  if (/^425/i.test(input.type ?? "")) s += 5;
  if ((input.items ?? []).some((i) => i.code === "2.01")) s += 4;
  if (
    /\b(?:acqui(?:re|res|red|sition)|merg(?:e|es|ed|ing|er)|takeover|buyout|definitive agreement to acquire)\b/i.test(
      cue,
    )
  ) {
    s += 5;
  }
  // Ownership transfer language beats partnership when both appear.
  if (
    /\b(?:acquire|acquisition|merg(?:e|er)|takeover)\b/i.test(cue) &&
    !/\blicen/i.test(cue)
  ) {
    s += 2;
  }
  // Explicit M&A fact slots from extract.
  if (
    /\btarget\b/i.test(cue) &&
    /\b(?:deal value|purchase price|\$)\b/i.test(cue)
  ) {
    s += 4;
  }
  return s;
}

function scorePartnership(cue: string, input: SubjectTitleInput): number {
  let s = 0;
  if (input.eventCategory === "deals") s += 1;
  if ((input.items ?? []).some((i) => i.code === "1.01")) s += 2;
  if (
    /\b(?:strategic partnership|partnership|collaborat(?:e|ion)|co-develop|joint venture|distribution agreement|licensing agreement|\blicen[cs]e[sd]?\b)\b/i.test(
      cue,
    )
  ) {
    s += 5;
  }
  // Downgrade if clearly M&A ownership transfer.
  if (/\b(?:acqui(?:re|res|red|sition)|merger|takeover|buyout)\b/i.test(cue)) {
    s -= 4;
  }
  return s;
}

function scoreRegulatory(cue: string, input: SubjectTitleInput): number {
  let s = 0;
  if (input.eventCategory === "regulatory") s += 4;
  if (
    /\b(?:FDA|EMA|SEC|FTC|DOJ|Health Canada)\b.{0,40}\b(?:approv|reject|CRL|complete response|accept(?:s|ed)? for review|fast track|breakthrough|orphan|priority review|clinical hold|clear(?:s|ed|ance))\b/i.test(
      cue,
    ) ||
    /\b(?:approv|reject|CRL|clinical hold|fast track|breakthrough)\b.{0,40}\b(?:FDA|EMA)\b/i.test(
      cue,
    )
  ) {
    s += 6;
  }
  // Approval after Phase 3 → regulatory is primary.
  if (/\bapprov/i.test(cue) && /\b(?:FDA|EMA)\b/i.test(cue)) s += 3;
  return s;
}

function scoreClinical(cue: string, input: SubjectTitleInput): number {
  let s = 0;
  if (input.eventCategory === "clinical") s += 4;
  if (/clinical trial/i.test(input.type ?? "")) s += 3;
  if (
    /\b(?:phase\s*[123]|topline|primary endpoint|interim results|clinical (?:trial )?results)\b/i.test(
      cue,
    )
  ) {
    s += 4;
  }
  // If FDA approval is the headline event, clinical is secondary.
  if (
    /\b(?:FDA|EMA)\b.{0,30}\bapprov/i.test(cue) ||
    /\bapprov.{0,30}\b(?:FDA|EMA)\b/i.test(cue)
  ) {
    s -= 6;
  }
  return s;
}

/**
 * Identify primary catalyst subject among the five engine subjects.
 * Returns null when none of the five clearly apply (caller keeps other subjects).
 */
export function identifyPrimaryEngineSubject(
  input: SubjectTitleInput,
  facts: SubjectTitleFact[],
): EngineSubject | null {
  const map = factMap(facts);
  const cue = cueText(input, map);

  const scores: Array<{ subject: EngineSubject; score: number }> = [
    { subject: "regulatory", score: scoreRegulatory(cue, input) },
    { subject: "financing", score: scoreFinancing(cue, input) },
    { subject: "ma", score: scoreMa(cue, input) },
    { subject: "partnership", score: scorePartnership(cue, input) },
    { subject: "clinical", score: scoreClinical(cue, input) },
  ];

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0]!;
  if (top.score < 3) return null;

  // Tie-break: regulatory over clinical when both mention FDA/phase.
  if (
    top.subject === "clinical" &&
    scores.find((s) => s.subject === "regulatory")!.score >= 5
  ) {
    return "regulatory";
  }
  // Tie-break: M&A over partnership when acquisition language wins.
  if (
    top.subject === "partnership" &&
    scores.find((s) => s.subject === "ma")!.score >
      scores.find((s) => s.subject === "partnership")!.score
  ) {
    return "ma";
  }

  return top.subject;
}

function selectFinancingCase(
  cue: string,
  map: Map<string, string>,
): FinancingCase {
  const money = extractMoney(cue, map);
  const price = extractSharePrice(cue, map);
  if (/\bregistered direct\b/i.test(cue)) return "F3";
  if (/\bprivate placement\b/i.test(cue)) return "F4";
  if (
    /\b(?:credit facility|term loan|debt financing|senior notes|convertible notes)\b/i.test(
      cue,
    ) ||
    /\bstructured note\b/i.test(cue)
  ) {
    return "F6";
  }
  if (/\bpric(?:es|ed|ing)\b/i.test(cue) && (money || price)) return "F2";
  if (
    /\b(?:public offering|follow-?on)\b/i.test(cue) ||
    (/\bequity offering\b/i.test(cue) && !/\bshelf\b|\bATM\b|424B/i.test(cue))
  ) {
    return "F1";
  }
  // Shelf / ATM / 424B still financing — F5 with structure-aware fill.
  if (money) return "F5";
  return "F5";
}

function selectMaCase(cue: string, map: Map<string, string>): MaCase {
  const status = findLabeled(map, "status") ?? "";
  const blob = `${status} ${cue}`;
  const terminated =
    /\b(?:terminat(?:e|es|ed|ing)?|abandon(?:s|ed)?|withdrawn|broken)\b/i.test(
      blob,
    );
  if (terminated) return "M20";

  const closed =
    /\b(?:clos(?:e|ed|ing)|completes?|completed|consummat)\b/i.test(blob);
  const explores =
    /\b(?:explor(?:e|es|ing)|evaluat(?:e|es|ing)|consider(?:s|ing)?)\b.{0,40}\b(?:acqui|merger|takeover)\b/i.test(
      blob,
    ) || /\bexploratory\b.{0,20}\b(?:bid|offer|acquisition)\b/i.test(blob);
  const proposes =
    /\b(?:propos(?:e|es|ed|al)|non[-\s]?binding|letter of intent|\bLOI\b)\b/i.test(
      blob,
    );
  const takeover = /\b(?:takeover|tender offer)\b/i.test(blob);
  const definitive =
    /\bdefinitive agreement\b|\benters?\s+into\s+(?:a\s+)?definitive\b/i.test(
      blob,
    );
  const mergerOnly =
    /\bmerg(?:e|er|es|ing)\b/i.test(blob) && !/\bacqui/i.test(blob);
  const agrees = /\bagrees?\b|\bentered into (?:an? )?agreement\b/i.test(blob);
  const announces = /\bannounc(?:e|es|ed|ing)\b/i.test(blob);
  const buys = /\bagrees?\s+to\s+buy\b|\bto\s+buy\b/i.test(blob);

  const perShare = extractSharePrice(cue, map);
  const money = extractMoney(cue, map);
  const target = extractTarget(map);
  const asset = extractAsset(map, cue);
  const premium = extractPremiumPct(cue, map);

  // Most specific scenarios first.
  if (explores && (target || asset)) return "M9";
  if (proposes && target) return "M8";
  if (takeover && target && perShare) return "M10";
  if (definitive && target) return "M13";
  if (mergerOnly) return "M7";

  if (closed && money && target) return "M18";
  if (closed && target) return "M6";
  if (closed && money && asset) return "M12";

  if (target && isAllStock(cue, map)) return "M15";
  if (target && isCashAndStock(cue, map)) return "M16";
  if (target && premium && (agrees || announces)) return "M17";

  if (asset && money && closed) return "M12";
  if (asset && money) return "M11";

  if (target && perShare && buys) return "M14";
  if (target && perShare) return "M2";

  // Default valued company deal → Agrees to Acquire for $X (primary template).
  // "Announces $XM Acquisition of Target" only for that exact announce+$ order.
  if (
    target &&
    money &&
    /\bannounc(?:e|es|ed|ing)\s+\$[\d.,]+[MB]?\s+Acquisition\b/i.test(blob) &&
    !agrees
  ) {
    return "M19";
  }
  if (target && money) return "M1";

  if (target && agrees) return "M5";
  if (target) return "M4";

  // Thin deal cue — announce line without inventing a target.
  return "M4";
}

function selectRegulatoryCase(
  cue: string,
  map: Map<string, string>,
): RegulatoryCase {
  const outcome =
    findLabeled(map, "outcome", "action", "status", "decision") ?? "";
  const blob = `${outcome} ${cue}`;
  if (/\bclinical hold\b/i.test(blob)) return "R5";
  if (
    /\b(?:fast track|breakthrough|orphan drug|priority review)\b/i.test(blob) &&
    !/\bapprov/i.test(blob)
  ) {
    return "R4";
  }
  if (/\baccept(?:s|ed)?\b.{0,20}\breview\b|\bfor review\b/i.test(blob))
    return "R3";
  if (/\b(?:reject|denied|denies|refusal to file)\b/i.test(blob)) return "R2";
  if (/\b(?:CRL|complete response letter)\b/i.test(blob)) return "R2";
  if (
    /\b(?:clear(?:s|ed|ance)|510\(k\)|cleared)\b/i.test(blob) &&
    !/\bapprov/i.test(blob)
  ) {
    return "R6";
  }
  if (/\bapprov/i.test(blob)) return "R1";
  return "R7";
}

function selectPartnershipCase(
  cue: string,
  map: Map<string, string>,
): PartnershipCase {
  const money = extractMoney(cue, map);
  if (/\bexpand(?:s|ed|ing)?\b.{0,20}\bpartnership\b/i.test(cue)) return "P6";
  if (/\blicen/i.test(cue)) return money ? "P4" : "P4";
  if (/\bcollaborat/i.test(cue)) return "P3";
  if (/\bcommercial agreement|distribution agreement\b/i.test(cue)) return "P5";
  if (money) return "P1";
  return "P2";
}

function selectClinicalCase(
  cue: string,
  map: Map<string, string>,
): ClinicalCase {
  const status = findLabeled(map, "status", "result", "outcome") ?? "";
  const blob = `${status} ${cue}`;
  const pct = extractPct(cue, map);
  if (
    /\bmiss(?:es|ed)?\b.{0,30}\bprimary\b|\bdid not meet\b.{0,20}\bprimary\b/i.test(
      blob,
    )
  ) {
    return "C2";
  }
  if (/\b(?:met|meets|achieved)\b.{0,30}\bprimary\b/i.test(blob)) {
    return pct ? "C1" : "C1";
  }
  if (/\bmixed\b/i.test(blob)) return "C5";
  if (/\bnegative\b/i.test(blob)) return "C4";
  if (
    /\bpositive\b/i.test(blob) &&
    /\b(?:results?|data|topline)\b/i.test(blob)
  ) {
    return "C3";
  }
  if (pct && /\b(?:improvement|reduction)\b/i.test(blob)) return "C7";
  if (/\btopline\b/i.test(blob)) return "C6";
  return "C6";
}

function fillFinancing(
  caseId: FinancingCase,
  company: string,
  cue: string,
  map: Map<string, string>,
): string {
  const amount = extractMoney(cue, map);
  const price = extractSharePrice(cue, map);
  const shares = extractShareCount(cue, map);

  switch (caseId) {
    case "F1":
      return amount
        ? `${company} Announces ${amount} Public Offering`
        : `${company} Announces Public Offering`;
    case "F2":
      if (amount && price)
        return `${company} Prices ${amount} Offering at ${price}`;
      if (shares && price)
        return `${company} Prices ${shares} Offering at ${price.replace("/Share", "")}`;
      if (amount) return `${company} Prices ${amount} Offering`;
      return `${company} Prices Offering`;
    case "F3":
      if (amount && price) {
        return `${company} Prices ${amount} Registered Direct Offering at ${price}`;
      }
      return amount
        ? `${company} Announces ${amount} Registered Direct Offering`
        : `${company} Announces Registered Direct Offering`;
    case "F4":
      return amount
        ? `${company} Announces ${amount} Private Placement`
        : `${company} Announces Private Placement`;
    case "F6":
      if (/\bcredit facility\b/i.test(cue) && amount) {
        return `${company} Announces ${amount} Credit Facility`;
      }
      return amount
        ? `${company} Secures ${amount} Debt Financing`
        : `${company} Announces Debt Financing`;
    case "F5":
    default:
      // Desk voice: files / sets up (not vague "Announces Financing") —
      // matches ARTICLE_BY_SUBJECT + FEED-TITLE-GUIDELINES thin capital.
      if (/\bat-the-market\b|\bATM\b/i.test(cue)) {
        return amount
          ? `${company} sets up ${amount} at-the-market (ATM) program`
          : `${company} sets up at-the-market (ATM) equity program`;
      }
      if (/\bshelf\b|^S-3/i.test(cue)) {
        return amount
          ? `${company} files ${amount} shelf registration`
          : `${company} - Shelf Registration Filed (Capital Raise Window)`;
      }
      if (/\b424B\d*|prospectus|stock offering/i.test(cue)) {
        return amount
          ? `${company} files ${amount} equity offering`
          : `${company} - Stock Offering Filed (Dilution Ahead)`;
      }
      // Generic capital raise with size — still never invent dollars.
      if (amount) {
        return `${company} files ${amount} equity offering`;
      }
      // Thin unknown instrument: professional ground-rule, not a chip.
      return `${company} - Stock Offering Filed (Dilution Ahead)`;
  }
}

function fillMa(
  caseId: MaCase,
  company: string,
  cue: string,
  map: Map<string, string>,
): string {
  const buyer = extractBuyer(map, company);
  const target = extractTarget(map);
  const asset = extractAsset(map, cue);
  const amount = extractMoney(cue, map);
  const perShare = extractSharePrice(cue, map);
  const premium = extractPremiumPct(cue, map);
  const thin = `${buyer} - Acquisition Announced (Deal in Play)`;

  switch (caseId) {
    case "M1":
      if (target && amount)
        return `${buyer} Agrees to Acquire ${target} for ${amount}`;
      if (target) return `${buyer} Agrees to Acquire ${target}`;
      return thin;
    case "M2":
      if (target && perShare)
        return `${buyer} to Acquire ${target} for ${perShare}`;
      return fillMa("M4", company, cue, map);
    case "M3":
      if (target && amount)
        return `${buyer} to Acquire ${target} in ${amount} Deal`;
      if (target) return `${buyer} to Acquire ${target}`;
      return thin;
    case "M4":
      if (target && amount)
        return `${buyer} Announces ${amount} Acquisition of ${target}`;
      return target
        ? `${buyer} Announces Acquisition of ${target}`
        : amount
          ? `${buyer} Announces ${amount} Acquisition`
          : thin;
    case "M5":
      return target ? `${buyer} Agrees to Acquire ${target}` : thin;
    case "M6":
      return target
        ? `${buyer} Completes Acquisition of ${target}`
        : `${buyer} - Acquisition Closed`;
    case "M7": {
      const other = target || findLabeled(map, "partner", "counterparty");
      return other
        ? `${buyer} Agrees to Merge With ${other}`
        : `${buyer} Announces Merger`;
    }
    case "M8":
      return target ? `${buyer} Proposes Acquisition of ${target}` : thin;
    case "M9":
      return target
        ? `${buyer} Explores Acquisition of ${target}`
        : asset
          ? `${buyer} Explores Acquisition of ${asset}`
          : thin;
    case "M10":
      if (target && perShare)
        return `${buyer} Launches Takeover of ${target} for ${perShare}`;
      return target ? `${buyer} Launches Takeover of ${target}` : thin;
    case "M11":
      if (asset && amount) return `${buyer} to Acquire ${asset} for ${amount}`;
      return asset
        ? `${buyer} to Acquire ${asset}`
        : fillMa("M3", company, cue, map);
    case "M12":
      if (asset && amount) return `${buyer} Acquires ${asset} for ${amount}`;
      return asset
        ? `${buyer} Acquires ${asset}`
        : fillMa("M6", company, cue, map);
    case "M13":
      return target
        ? `${buyer} Enters Definitive Agreement to Acquire ${target}`
        : thin;
    case "M14":
      if (target && perShare)
        return `${buyer} Agrees to Buy ${target} for ${perShare}`;
      return target ? `${buyer} Agrees to Buy ${target}` : thin;
    case "M15":
      return target ? `${buyer} to Acquire ${target} in All-Stock Deal` : thin;
    case "M16":
      return target
        ? `${buyer} to Acquire ${target} in Cash-and-Stock Deal`
        : thin;
    case "M17":
      if (target && premium)
        return `${buyer} Agrees to Acquire ${target} at ${premium} Premium`;
      return fillMa("M5", company, cue, map);
    case "M18":
      if (target && amount)
        return `${buyer} Completes ${amount} Acquisition of ${target}`;
      return fillMa("M6", company, cue, map);
    case "M19":
      if (target && amount)
        return `${buyer} Announces ${amount} Acquisition of ${target}`;
      return fillMa("M4", company, cue, map);
    case "M20":
      return target
        ? `${buyer} Terminates Acquisition of ${target}`
        : `${buyer} Terminates Acquisition`;
    default:
      return thin;
  }
}

function fillRegulatory(
  caseId: RegulatoryCase,
  company: string,
  cue: string,
  map: Map<string, string>,
): string {
  const regulator = extractRegulator(cue, map);
  const product = extractProduct(map, cue);
  const designation =
    findLabeled(map, "designation") ||
    cue.match(
      /\b(Fast Track|Breakthrough Therapy|Orphan Drug|Priority Review)\b/i,
    )?.[1] ||
    null;
  const application =
    findLabeled(map, "application", "nda", "bla", "maa") || null;
  const thinApproval = /FDA/i.test(regulator)
    ? `${company} Receives FDA Approval!`
    : `${regulator} Approves ${company}`;

  switch (caseId) {
    case "R1":
      // Never invent a product name — bang / agency+company when product unknown.
      return product
        ? `${regulator} Approves ${company}'s ${product}`
        : thinApproval;
    case "R2":
      if (/\bCRL|complete response/i.test(cue)) {
        return product
          ? `${company} Receives ${regulator} CRL for ${product}`
          : `${company} Receives ${regulator} CRL`;
      }
      return product
        ? `${regulator} Rejects ${company}'s ${product}`
        : `${regulator} Rejects ${company}'s Application`;
    case "R3":
      return application
        ? `${regulator} Accepts ${company}'s ${application} for Review`
        : `${regulator} Accepts ${company}'s Application for Review`;
    case "R4":
      if (designation && product) {
        return `${regulator} Grants ${designation} to ${company}'s ${product}`;
      }
      if (designation) {
        return `${regulator} Grants ${designation} to ${company}`;
      }
      return product
        ? `${regulator} Grants Designation to ${company}'s ${product}`
        : `${company} - Regulatory Action Update`;
    case "R5":
      return product
        ? `${regulator} Places ${company}'s ${product} on Clinical Hold`
        : `${regulator} Places ${company}'s Program on Clinical Hold`;
    case "R6":
      return product
        ? `${regulator} Clears ${company}'s ${product}`
        : `${regulator} Clears ${company}`;
    case "R7":
    default:
      return `${company} - Regulatory Action Update`;
  }
}

function fillPartnership(
  caseId: PartnershipCase,
  company: string,
  cue: string,
  map: Map<string, string>,
): string {
  const partner = extractPartner(map);
  const amount = extractMoney(cue, map);
  const program =
    extractProduct(map, cue) ||
    findLabeled(map, "nature", "scope", "focus", "area", "program");

  switch (caseId) {
    case "P1":
      return partner && amount
        ? `${company} Enters ${amount} Partnership With ${partner}`
        : amount
          ? `${company} Enters ${amount} Partnership`
          : fillPartnership("P2", company, cue, map);
    case "P3":
      if (partner && program) {
        return `${company} Enters Collaboration With ${partner} for ${program}`;
      }
      return partner
        ? `${company} Enters Collaboration With ${partner}`
        : `${company} Announces Collaboration`;
    case "P4":
      if (partner && amount) {
        return `${company} Signs ${amount} Licensing Agreement With ${partner}`;
      }
      return partner
        ? `${company} Signs Licensing Agreement With ${partner}`
        : `${company} Signs Licensing Agreement`;
    case "P5":
      return partner
        ? `${company} Signs Commercial Agreement With ${partner}`
        : `${company} Signs Commercial Agreement`;
    case "P6":
      return partner
        ? `${company} Expands Partnership With ${partner}`
        : `${company} Expands Partnership`;
    case "P2":
    default:
      // Shorter desk scan: "partners with" beats long announce chip when partner known.
      return partner
        ? `${company} partners with ${partner}`
        : `${company} - Strategic Partnership Announced`;
  }
}

function fillClinical(
  caseId: ClinicalCase,
  company: string,
  cue: string,
  map: Map<string, string>,
): string {
  const phase = extractPhase(cue, map);
  const phaseLabel = phase ? `Phase ${phase}` : null;
  const drug = extractProduct(map, cue);
  const pct = extractPct(cue, map);
  const endpoint =
    findLabeled(map, "endpoint", "primary endpoint") || "Primary Endpoint";

  switch (caseId) {
    case "C1":
      if (phaseLabel && pct) {
        return `${company} ${phaseLabel} Trial Meets Primary Endpoint With ${pct} Improvement`;
      }
      {
        const condition =
          findLabeled(map, "condition", "indication", "disease", "setting") ||
          null;
        if (phaseLabel && condition) {
          return `${company} ${phaseLabel} Trial Meets Primary Endpoint in ${condition}`;
        }
      }
      return phaseLabel
        ? `${company} ${phaseLabel} Trial Meets Primary Endpoint`
        : `${company} Trial Meets Primary Endpoint`;
    case "C2":
      return phaseLabel
        ? `${company} ${phaseLabel} Trial Misses Primary Endpoint`
        : `${company} Trial Misses Primary Endpoint`;
    case "C3":
      return phaseLabel && drug
        ? `${company} Reports Positive ${phaseLabel} Results for ${drug}`
        : phaseLabel
          ? `${company} Reports Positive ${phaseLabel} Results`
          : `${company} Reports Positive Clinical Results`;
    case "C4":
      return phaseLabel && drug
        ? `${company} Reports Negative ${phaseLabel} Results for ${drug}`
        : phaseLabel
          ? `${company} Reports Negative ${phaseLabel} Results`
          : `${company} Reports Negative Clinical Results`;
    case "C5":
      return phaseLabel && drug
        ? `${company} Reports Mixed ${phaseLabel} Results for ${drug}`
        : phaseLabel
          ? `${company} Reports Mixed ${phaseLabel} Results`
          : `${company} Reports Mixed Clinical Results`;
    case "C7":
      if (phaseLabel && pct) {
        const namedEndpoint = endpoint !== "Primary Endpoint" ? endpoint : null;
        return namedEndpoint
          ? `${company} ${phaseLabel} Trial Shows ${pct} Improvement in ${namedEndpoint}`
          : `${company} ${phaseLabel} Trial Shows ${pct} Improvement`;
      }
      return fillClinical("C6", company, cue, map);
    case "C6":
    default:
      if (phaseLabel && drug) {
        return `${company} Reports Topline ${phaseLabel} Results for ${drug}`;
      }
      return phaseLabel
        ? `${company} Reports Topline ${phaseLabel} Results`
        : `${company} - Clinical Trial Results Update`;
  }
}

function validateTitle(title: string, company: string): string | null {
  const t = normalizeWs(title);
  if (!t || t.length < 8) return null;
  if (/unknown company/i.test(t)) return null;
  // Soft word-count preference (not a hard fail).
  const words = t.split(/\s+/).length;
  if (words > 22) {
    // Keep but do not invent — return as-is; callers may truncate display.
  }
  if (
    !t.toLowerCase().includes(company.split(/\s+/)[0]!.toLowerCase()) &&
    !/\$/.test(t)
  ) {
    // Regulatory titles may lead with FDA — OK.
    if (!/^(?:FDA|EMA|SEC|FTC|DOJ)\b/i.test(t)) {
      // still allow
    }
  }
  return t;
}

/**
 * Build a case-engine title for one of the five subjects.
 * Returns null when the engine does not apply (other subjects / unknown).
 */
export function buildCaseEngineTitle(
  input: SubjectTitleInput,
  facts: SubjectTitleFact[],
): string | null {
  const subject = identifyPrimaryEngineSubject(input, facts);
  if (!subject) return null;

  const map = factMap(facts);
  const cue = cueText(input, map);
  const company = companyOf(input);

  let title: string;
  switch (subject) {
    case "financing":
      title = fillFinancing(selectFinancingCase(cue, map), company, cue, map);
      break;
    case "ma":
      title = fillMa(selectMaCase(cue, map), company, cue, map);
      break;
    case "regulatory":
      title = fillRegulatory(selectRegulatoryCase(cue, map), company, cue, map);
      break;
    case "partnership":
      title = fillPartnership(
        selectPartnershipCase(cue, map),
        company,
        cue,
        map,
      );
      break;
    case "clinical":
      title = fillClinical(selectClinicalCase(cue, map), company, cue, map);
      break;
    default:
      return null;
  }

  return validateTitle(title, company);
}

/** Map taxonomy category to whether the case engine should attempt a title. */
export function categoryEligibleForCaseEngine(
  eventCategory: string | null | undefined,
): boolean {
  return (
    eventCategory === "capital" ||
    eventCategory === "deals" ||
    eventCategory === "regulatory" ||
    eventCategory === "clinical" ||
    // Unclassified SEC forms may still resolve via type/items cues.
    eventCategory == null ||
    eventCategory === "other"
  );
}
