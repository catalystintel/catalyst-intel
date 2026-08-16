/**
 * Subject-aware tape titles from extracted keyFacts (see ARTICLE_BY_SUBJECT.md).
 * Freer than cookie-cutter `{Company} - {Subject}` when real facts exist;
 * never invents numbers — only uses provided keyFacts / grounded text cues.
 */

import {
  earningsQuarterLabel,
  formatAnalystRatingTitle,
  formatClinicalTrialTitle,
  formatEarningsReportTitle,
  formatFdaApprovalTitle,
  formatForm4InsiderTitle,
  formatHaltTitle,
  formatPartnershipTitle,
  formatPriceTargetTitle,
  formatProspectusOfferingTitle,
  formatRegulatoryActionTitle,
  formatSchedule13DTitle,
  formatSchedule13GTitle,
  formatShelfRegistrationTitle,
  form4TitleKindFromSubcategory,
  resolveDisplayCompanyName,
  type Form4TitleKind,
} from "@/lib/catalysts/catalyst-titles";
import {
  isEventCategoryKey,
  type EventCategoryKey,
} from "@/lib/catalysts/taxonomy";
import {
  buildCaseEngineTitle,
  categoryEligibleForCaseEngine,
} from "@/lib/catalysts/subject-case-titles";

export type SubjectTitleFact = {
  label: string;
  value: string;
};

export type SubjectTitleInput = {
  eventCategory?: string | null;
  subcategory?: string | null;
  companyName?: string | null;
  symbol?: string | null;
  keyFacts?: SubjectTitleFact[] | null;
  title?: string | null;
  headline?: string | null;
  summary?: string | null;
  /** Filing / vendor type already on the row (e.g. S-3, 424B5, 8-K, 4). */
  type?: string | null;
  /** Parsed 8-K items (code + label) from fetch — enough to voice deals/capital. */
  items?: Array<{ code?: string | null; label?: string | null }> | null;
  /** Halt reason label when already resolved. */
  haltReason?: string | null;
  /** Explicit quarter (1–4) when known. */
  quarter?: number | null;
  /** Date hint for quarter inference. */
  dateYmd?: string | null;
};

function normalizeWs(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function companyOf(input: SubjectTitleInput): string {
  return resolveDisplayCompanyName(input.companyName, input.symbol);
}

function categoryOf(value?: string | null): EventCategoryKey {
  if (value && isEventCategoryKey(value)) return value;
  return "other";
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

function findFact(
  map: Map<string, string>,
  ...needles: string[]
): string | null {
  for (const [label, value] of map) {
    const hay = `${label} ${value}`.toLowerCase();
    if (needles.some((n) => hay.includes(n.toLowerCase()))) return value;
  }
  return null;
}

function findLabeled(
  map: Map<string, string>,
  ...exactOrIncludes: string[]
): string | null {
  for (const needle of exactOrIncludes) {
    const lower = needle.toLowerCase();
    for (const [label, value] of map) {
      if (label === lower || label.includes(lower)) return value;
    }
  }
  return findFact(map, ...exactOrIncludes);
}

/** True when a stored title already carries concrete detail beyond a taxonomy chip. */
export function looksFactEnrichedTitle(
  title: string | null | undefined,
): boolean {
  const t = normalizeWs(title ?? "");
  if (!t || t.length < 12) return false;
  // Dollar / percent / share counts / named people cues.
  if (/\$[\d.,]+\s*(?:[kmb]|mm|bn|billion|million)?/i.test(t)) return true;
  if (/\b\d+(?:\.\d+)?%/i.test(t)) return true;
  if (/\b\d[\d,]*(?:\.\d+)?\s*(?:shares?|sh)\b/i.test(t)) return true;
  if (/—\s*(?:Shelf|Offering|Amends shelf|13[DG]|Structured note)/i.test(t)) {
    return true;
  }
  // Dollar-backed capital sentences only — bare shelf/offering thin lines stay upgradeable.
  if (
    /\b(?:files|sets up|amends)\b.+\$(?:[\d.,]+)/i.test(t) &&
    /\b(?:shelf|at-the-market|\bATM\b|offering|notes)\b/i.test(t)
  ) {
    return true;
  }
  if (/\bsets up\b.+\bat-the-market\b|\bATM\b/i.test(t) && /\$/.test(t)) {
    return true;
  }
  // ATM / structured note voices (facility detail without requiring a parsed $).
  if (
    /\bsets up\b.+\bat-the-market\b|\bATM\b.+\b(?:program|facility|equity)\b/i.test(
      t,
    ) ||
    /\bprices structured notes\b/i.test(t) ||
    /\bstructured note pricing supplement\b/i.test(t)
  ) {
    return true;
  }
  // Dollar-backed Shelf Raise / Stock Offering Filed (…($500M)…)
  if (/\b(?:Shelf Raise Filed|Stock Offering Filed)\s*\([^)]*\$/i.test(t)) {
    return true;
  }
  if (
    /\b(?:to acquire|Agrees to Acquire|Completes Acquisition|Announces Acquisition|partners with|Announces Strategic Partnership|Enters .+ Partnership|Enters Collaboration|Signs .+ Licensing|collaborat|licenses?|announces partnership)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  // Dollar-backed capital announce/price/secure sentences only — bare
  // "Announces Financing" is legacy stiff, not fact-rich.
  if (
    /\b(?:Announces|Prices|Secures)\b.+\b(?:Offering|Financing|Private Placement|Credit Facility|Registered Direct)\b/i.test(
      t,
    ) &&
    /\$/.test(t)
  ) {
    return true;
  }
  if (
    /\b(?:wins|receives|Approves|Rejects|Accepts|Grants|Places|Clears)\b.+\b(?:FDA|EMA|agency|CRL|complete response|clearance|Clinical Hold|for Review)\b/i.test(
      t,
    ) ||
    /\b(?:FDA|EMA)\b.+\b(?:Approves|Rejects|Accepts|Grants|Places|Clears)\b/i.test(
      t,
    ) ||
    /\bclinical hold\b/i.test(t) ||
    /\breceives CRL\b/i.test(t)
  ) {
    return true;
  }
  if (/:\s+[A-Z][a-z]+.+(?:·|\$)/.test(t)) return true; // Form 4 style
  if (/\b(?:beat|miss)(?:s|ed)?\b/i.test(t) && /\b(?:eps|revenue)\b/i.test(t)) {
    return true;
  }
  if (/\bphase\s*[123ivx]+\b/i.test(t)) return true;
  if (/\b(?:primary endpoint|topline)\b/i.test(t)) {
    return true;
  }
  if (
    /\b(?:upgraded|downgraded|raises?|cuts?)\b.+\b(?:pt|target|to)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

/** Professional thin ground-rule voices (company + event phrase, no invented facts). */
export function looksProfessionalThinTitle(
  title: string | null | undefined,
): boolean {
  const t = normalizeWs(title ?? "");
  if (!t) return false;
  if (
    /\bShelf Registration Filed\b|\bStock Offering Filed\b|\bAcquisition Announced\b|\bAcquisition Closed\b|\bPartnership or Major Contract Announced\b|\bStrategic Partnership Announced\b|\bRegulatory Action Update\b|\bClinical Trial Results Update\b|\bClinical Trial Results Reported\b|\bAnnounces Public Offering\b|\bAnnounces Private Placement\b|\bAnnounces Registered Direct Offering\b|\bAnnounces Debt Financing\b|\bAnnounces Merger\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (/\bReceives FDA Approval!$/i.test(t)) return true;
  if (/^Halts\s*\(/i.test(t)) return true;
  return false;
}

/** Taxonomy / catalog chips that should yield to subject or ground-rule voices. */
export function looksTaxonomyChipTitle(
  title: string | null | undefined,
): boolean {
  const t = normalizeWs(title ?? "").toLowerCase();
  if (!t) return false;
  if (
    /^(?:8-k filing|current report|filing|shelf registration \(s-3\)|prospectus \/ offering \(424b\)|merger \/ acquisition \(425\)|m&a\s*\/\s*acquisition|m&a|acquisition|financing|announces financing|clinical trial(?: update)?|fda catalyst|capital markets|material agreement|new deal announced)$/i.test(
      t,
    )
  ) {
    return true;
  }
  // Allow & in chips like "M&A / acquisition". Do not treat company+verb
  // sentences (e.g. "AGPU Announces Financing") as catalog chips.
  if (
    /^[a-z0-9 ./\-&()]{3,40}$/i.test(t) &&
    !/\s-\s/.test(t) &&
    t.length < 48 &&
    !/\b(?:announces|files|sets up|prices|agrees|completes|partners|receives)\b/i.test(
      t,
    )
  ) {
    // Short catalog-style chips without a company separator.
    if (
      /\b(?:registration|offering|acquisition|m&a|partnership|clinical|regulatory|agreement|filing|financing)\b/i.test(
        t,
      )
    ) {
      return true;
    }
  }
  return false;
}

/** Legacy stiff voices we happily replace with professional thin or fact-rich titles. */
function looksLegacyStiffTitle(title: string | null | undefined): boolean {
  const t = normalizeWs(title ?? "");
  if (!t) return false;
  if (/New Deal Announced/i.test(t)) return true;
  if (/\bfiles shelf registration \(S-3\)$/i.test(t)) return true;
  if (/\bfiles stock offering \(dilution watch\)$/i.test(t)) return true;
  if (/\bAnnounces Acquisition\s*[—–-]\s*Deal in Play/i.test(t)) return true;
  if (/\bannounces strategic partnership$/i.test(t)) return true;
  if (/\bAnnounces Financing\b/i.test(t)) return true;
  if (/^M&A\s*\/\s*acquisition$/i.test(t)) return true;
  if (/\bclinical trial update$/i.test(t)) return true;
  if (/\bregulatory update$/i.test(t)) return true;
  if (/Shelf Registration \(S-3\)|Prospectus \/ Offering \(424B\)/i.test(t)) {
    return true;
  }
  return looksTaxonomyChipTitle(t);
}

/** Cue text from facts + stored title/headline/summary/type/items (never invents). */
function groundedCueText(
  input: SubjectTitleInput,
  map: Map<string, string>,
): string {
  const factBits = [...map.entries()].map(([k, v]) => `${k} ${v}`);
  const itemBits = (input.items ?? []).flatMap((i) => [
    i.code ?? "",
    i.label ?? "",
  ]);
  return normalizeWs(
    [
      ...factBits,
      ...itemBits,
      input.type ?? "",
      input.subcategory ?? "",
      input.title ?? "",
      input.headline ?? "",
      input.summary ?? "",
    ].join(" "),
  );
}

/**
 * Seed facts from fields already on the fetched row so thin keyFacts rows
 * still get subject-aware titles. Only copies/parses what is present —
 * never invents dollars or outcomes.
 */
export function seedFactsFromFetch(
  input: SubjectTitleInput,
): SubjectTitleFact[] {
  const seeded: SubjectTitleFact[] = [];
  const push = (label: string, value: string | null | undefined) => {
    const v = normalizeWs(value ?? "");
    if (!v) return;
    seeded.push({ label, value: v });
  };

  const formType = normalizeWs(input.type ?? "");
  if (formType) {
    push("Form", formType);
    if (/^S-3/i.test(formType)) push("Type", "Shelf registration");
    if (/^424B/i.test(formType)) push("Type", "Prospectus offering");
    if (/^425/i.test(formType)) push("Type", "Acquisition");
    if (/^SC\s*13D|^13D/i.test(formType)) push("Form", "SC 13D");
    if (/^SC\s*13G|^13G/i.test(formType)) push("Form", "SC 13G");
    if (/^(?:4(?:\/|$)|form\s*4)/i.test(formType)) push("Type", "Form 4");
  }

  for (const item of input.items ?? []) {
    const code = normalizeWs(item.code ?? "");
    const label = normalizeWs(item.label ?? "");
    if (code) push("Item", code);
    if (label) push("Event", label);
    if (
      code === "1.01" ||
      /material agreement|partnership|collaborat/i.test(label)
    ) {
      push("Type", "Material agreement");
    }
    if (code === "2.01" || /acquisition|disposition/i.test(label)) {
      push("Status", "closed");
      push("Type", "Acquisition");
    }
    if (code === "1.02" || /terminat/i.test(label)) {
      push("Status", "terminated");
    }
  }

  const sub = normalizeWs(input.subcategory ?? "");
  if (sub) push("Subcategory", sub);

  const cue = normalizeWs(
    [
      formType,
      sub,
      input.title ?? "",
      input.headline ?? "",
      input.summary ?? "",
    ]
      .concat(
        (input.items ?? []).map((i) => `${i.code ?? ""} ${i.label ?? ""}`),
      )
      .join(" "),
  );

  const amountMatch = cue.match(
    /\$[\d.,]+\s*(?:million|billion|mm|bn|[kmb](?!\w))?/i,
  );
  if (amountMatch?.[0]) {
    push("Amount", amountMatch[0].replace(/\s+/g, " ").trim());
  }

  const sharesMatch = cue.match(
    /\b([\d,.]+)\s*(?:million\s+)?(?:shares?|sh)\b/i,
  );
  if (sharesMatch?.[0]) {
    push("Shares", sharesMatch[0].replace(/\s+/g, " ").trim());
  }

  const phaseMatch = cue.match(/\bphase\s*([123ivx]+)\b/i);
  if (phaseMatch?.[1]) {
    push("Phase", phaseMatch[1].toUpperCase());
  }

  if (/\bat-the-market\b|\bATM\b/i.test(cue)) {
    push("Type", "ATM");
  }
  if (/\bshelf\b/i.test(cue) && !seeded.some((f) => /shelf/i.test(f.value))) {
    push("Type", "Shelf");
  }
  if (/\bstructured note/i.test(cue)) {
    push("Type", "Structured note");
  }
  if (/\bprimary endpoint\b/i.test(cue)) {
    push("Endpoint", "Primary endpoint");
    if (/\b(?:met|meets|achieved)\b/i.test(cue)) {
      push("Status", "met primary endpoint");
    } else if (/\b(?:miss(?:ed|es)?|fail(?:ed|s)?|did not meet)\b/i.test(cue)) {
      push("Status", "missed primary endpoint");
    }
  }
  if (/\bFDA\b/i.test(cue)) {
    push("Agency", "FDA");
    if (/\bapprov/i.test(cue)) push("Outcome", "approval");
    else if (/\bCRL\b|complete response/i.test(cue)) push("Outcome", "CRL");
    else if (/\bclinical hold\b/i.test(cue)) push("Outcome", "clinical hold");
  }
  if (isPartnershipCue(cue)) {
    // Don't classify legacy chip "Partnership or Major Contract Announced" as
    // partnership when the row is clearly M&A (target / deal value / 425).
    const keyText = (input.keyFacts ?? [])
      .map((f) => `${f.label} ${f.value}`)
      .join(" ");
    const maFacts = Boolean(
      /\b(?:target|buyer|acquirer|deal value|purchase price)\b/i.test(
        keyText,
      ) ||
      /^425/i.test(input.type ?? "") ||
      isAcquisitionCue(
        cue.replace(/Partnership or Major Contract Announced/gi, ""),
      ),
    );
    if (!maFacts) push("Type", "Partnership");
  }
  if (
    isAcquisitionCue(cue) &&
    !seeded.some((f) => /acquisition/i.test(f.value))
  ) {
    push("Type", "Acquisition");
  }

  // Seed M&A parties / status from title/summary so existing rows upgrade on read
  // even when enrich keyFacts never stored Target / Deal value labels.
  const maTarget = extractAcquisitionTargetFromCue(cue);
  if (maTarget) push("Target", maTarget);

  if (
    /\b(?:clos(?:e|es|ed|ing)|completes?|completed|consummat)\b.{0,48}\bacquisition\b/i.test(
      cue,
    ) &&
    !seeded.some((f) => /closed/i.test(f.value))
  ) {
    push("Status", "closed");
  }
  if (
    /\b(?:terminat(?:e|es|ed|ing)?|abandon(?:s|ed)?|withdrawn)\b.{0,48}\b(?:acquisition|deal|merger)\b/i.test(
      cue,
    ) &&
    !seeded.some((f) => /terminat/i.test(f.value))
  ) {
    push("Status", "terminated");
  }

  // Prefer Deal value label when $ came from an acquisition cue (case engine M1).
  if (
    isAcquisitionCue(cue) &&
    amountMatch?.[0] &&
    !seeded.some((f) => /^deal value$/i.test(f.label))
  ) {
    push("Deal value", amountMatch[0].replace(/\s+/g, " ").trim());
  }

  return seeded;
}

function mergeFacts(
  primary: SubjectTitleFact[],
  seeded: SubjectTitleFact[],
): SubjectTitleFact[] {
  const map = factMap(primary);
  const out = [...primary];
  for (const f of seeded) {
    const key = f.label.toLowerCase();
    if (map.has(key)) continue;
    // Allow multiple Item/Event entries via unique labels.
    if (key === "item" || key === "event") {
      out.push(f);
      continue;
    }
    map.set(key, f.value);
    out.push(f);
  }
  return out;
}

function isPartnershipCue(cue: string): boolean {
  return /\b(?:partnership|partner(?:s|ed|ing)?\b|collaborat(?:e|ion|ing)|co-develop|joint venture|\blicen[cs]e[sd]?\b|\blicensing\b)/i.test(
    cue,
  );
}

function isAcquisitionCue(cue: string): boolean {
  return /\b(?:acqui(?:re|res|red|sition)|merger|takeover|buyout|disposition|425)\b/i.test(
    cue,
  );
}

/** Pull a named target from acquire / acquisition-of phrasing already on the row. */
function extractAcquisitionTargetFromCue(cue: string): string | null {
  const m = cue.match(
    /\b(?:(?:(?:agrees?|plans?|moves?|enters?\s+(?:into\s+)?(?:a\s+)?definitive\s+agreement)\s+to|to|will)\s+acquire|acquires|acquired|acquisition\s+of)\s+([A-Z][\w.&']*(?:\s+(?:[A-Z][\w.&']*|and|of|the|Inc\.?|Corp\.?|Ltd\.?|LLC|Co\.?|PLC|Group|Holdings?)){0,6})/,
  );
  if (!m?.[1]) return null;
  let target = normalizeWs(m[1]);
  target = target.replace(
    /\s+(?:for|in|at|from|via|through|under|worth|valued|all-cash|cash|stock)\b.*$/i,
    "",
  );
  if (!target || /^(?:a|an|the|its|their|another)$/i.test(target)) return null;
  if (/^(?:acquisition|merger|deal|agreement)$/i.test(target)) return null;
  return target;
}

/** Case-engine M&A shaped titles (already on guidelines). */
function looksCaseShapedMaTitle(title: string): boolean {
  return /\b(?:Agrees to Acquire|Agrees to Buy|to Acquire .+ in \$[\d.]+[MB]? Deal|to Acquire .+ for \$[\d.]+\/Share|to Acquire .+ in (?:All-Stock|Cash-and-Stock) Deal|Completes (?:\$[\d.]+[MB]?\s+)?Acquisition(?:\s+of)?|Announces (?:\$[\d.]+[MB]?\s+)?Acquisition(?:\s+of)?|Terminates Acquisition(?:\s+of)?|Agrees to Merge With|Proposes Acquisition of|Explores Acquisition of|Launches Takeover of|Enters Definitive Agreement to Acquire)\b/i.test(
    title,
  );
}

/** Legacy M&A fact sentences that should yield to case templates on read. */
function looksLegacyMaFactTitle(title: string): boolean {
  return /\b(?:moves to acquire|to acquire|acquires\b|acquired\b|acquisition of|closes .{0,48}acquisition|completes? .{0,24}acquisition|terminates? .{0,24}(?:acquisition|deal)|announces .{0,40}acquisition|agrees to merge|merger with|definitive agreement|all-cash|buyout|takeover)\b/i.test(
    title,
  );
}

/** Pre-case financing voices (Title Case Announces, closes facility, etc.). */
function looksLegacyFinancingFactTitle(title: string): boolean {
  return /\b(?:Announces \$.+\b(?:Shelf|ATM|At-The-Market|Stock Offering|Equity Offering|Public Offering|Private Placement|Registered Direct|Credit Facility|Financing|Notes)\b|closes?.{0,24}\b(?:credit facility|term loan)|secures?.{0,24}\b(?:debt|financing|facility)|prices?.{0,24}\boffering|files \$.+\b(?:shelf|equity offering|offering)\b|sets up \$.+\bat-the-market|\bATM\b)/i.test(
    title,
  );
}

/** Pre-case partnership / license / collab builder voices. */
function looksLegacyPartnershipFactTitle(title: string): boolean {
  return /\b(?:partners with|announces (?:strategic )?partnership|Announces Strategic Partnership|announces collaboration|Enters .+ Partnership|Enters Collaboration|collaborat(?:es|e|ion) with|and .+ collaborate on|licenses?\b.+\bto\b|Signs .+ Licensing)\b/i.test(
    title,
  );
}

/** Pre-case regulatory builder voices (company-first wins/receives, hold phrasing). */
function looksLegacyRegulatoryFactTitle(title: string): boolean {
  return /\b(?:wins (?:FDA|EMA) approval|receives (?:FDA|EMA) (?:approval|CRL|Complete Response)|placed on clinical hold|faces clinical hold|(?:FDA|EMA) clears\b|(?:FDA|EMA) Approves\b|(?:FDA|EMA) Rejects\b|(?:FDA|EMA) Places\b|(?:FDA|EMA) Grants\b|(?:FDA|EMA) Accepts\b|Receives FDA Approval!)\b/i.test(
    title,
  );
}

/** Pre-case clinical builder voices (lowercase trial / phase update). */
function looksLegacyClinicalFactTitle(title: string): boolean {
  return /\b(?:phase\s*[123ivx]+.{0,40}(?:trial|study).{0,40}(?:meets|misses|met|missed).{0,20}primary|phase\s*[123ivx]+\s+clinical trial update|reports (?:positive|negative|mixed|topline).{0,40}(?:phase|results)|clinical update —)\b/i.test(
    title,
  );
}

/** True when stored already matches the case-engine M&A / financing / etc. shape. */
function looksCaseShapedEngineTitle(title: string): boolean {
  if (looksCaseShapedMaTitle(title)) return true;
  if (
    /\b(?:files \$.+\bshelf registration|sets up \$.+\bat-the-market \(ATM\)|files \$.+\bequity offering|Announces \$.+\b(?:Public Offering|Registered Direct|Private Placement|Credit Facility|Financing)|Prices \$.+\b(?:Offering|Registered Direct)|Secures \$.+\bDebt Financing)\b/i.test(
      title,
    )
  ) {
    return true;
  }
  if (
    /\b(?:Enters \$.+\bPartnership With|Enters Collaboration With|Signs (?:\$.+\s)?Licensing Agreement With|partners with)\b/i.test(
      title,
    )
  ) {
    return true;
  }
  if (
    /^(?:FDA|EMA|SEC|FTC|DOJ)\b.+\b(?:Approves|Rejects|Accepts|Grants|Places|Clears)\b/i.test(
      title,
    ) ||
    /\bReceives (?:FDA|EMA) CRL\b/i.test(title)
  ) {
    return true;
  }
  if (
    /\bPhase\s*[123ivx]+\s+Trial (?:Meets|Misses) Primary Endpoint\b/i.test(
      title,
    ) ||
    /\bReports (?:Positive|Negative|Mixed|Topline) Phase\b/i.test(title)
  ) {
    return true;
  }
  return false;
}

/**
 * Keep study/wire headlines that are denser than the case template
 * (named trials, protocol IDs, extra grounded detail) — never invent facts.
 */
function isDenserSpecificHeadline(stored: string, engineered: string): boolean {
  const s = normalizeWs(stored);
  const eng = normalizeWs(engineered);
  if (!s || !eng) return false;
  if (s === eng || s.toLowerCase() === eng.toLowerCase()) return false;
  // Named studies / protocol IDs missing from the template — always denser.
  if (
    /\b(?:KEYNOTE|CHECKMATE|NCT\d{6,}|protocol\s+[A-Z0-9-]+)\b/i.test(s) &&
    !/\b(?:KEYNOTE|CHECKMATE|NCT\d{6,}|protocol\s+[A-Z0-9-]+)\b/i.test(eng)
  ) {
    return true;
  }
  // Legacy family voices always yield — even when looksFactEnrichedTitle.
  if (
    looksLegacyFinancingFactTitle(s) ||
    looksLegacyPartnershipFactTitle(s) ||
    looksLegacyRegulatoryFactTitle(s) ||
    looksLegacyClinicalFactTitle(s) ||
    looksLegacyMaFactTitle(s)
  ) {
    return false;
  }
  if (!looksFactEnrichedTitle(s)) return false;
  // Materially longer with concrete extra detail.
  if (s.length > eng.length + 8 && hasUsefulDetail(s, eng)) {
    return true;
  }
  return false;
}

function earningsTitle(
  input: SubjectTitleInput,
  map: Map<string, string>,
): string {
  const company = companyOf(input);
  const q = earningsQuarterLabel(input.quarter, input.dateYmd);
  const eps = findLabeled(map, "eps", "earnings per share");
  const surprise = findLabeled(map, "surprise");
  const revenue = findLabeled(map, "revenue", "sales");
  const guidance = findLabeled(map, "guidance");

  const beatMiss =
    surprise?.match(/\b(beat|miss)/i)?.[1] ??
    eps?.match(/\b(beat|miss)/i)?.[1] ??
    null;

  if (eps && beatMiss) {
    const side = beatMiss.toLowerCase() === "beat" ? "beats" : "misses";
    return `${company} ${q} EPS ${side} (${eps})`;
  }
  if (eps && surprise) {
    return `${company} ${q} EPS ${eps} · surprise ${surprise}`;
  }
  if (eps && revenue) {
    return `${company} ${q} earnings — EPS ${eps}, sales ${revenue}`;
  }
  if (guidance && /rais|cut|lower|withdraw|suspend/i.test(guidance)) {
    return `${company} ${q} guidance update — ${guidance}`;
  }
  return formatEarningsReportTitle(q, company);
}

function partnershipTitle(
  input: SubjectTitleInput,
  map: Map<string, string>,
): string {
  const company = companyOf(input);
  const partnerRaw = findLabeled(
    map,
    "partner",
    "counterparty",
    "collaborator",
    "licensee",
    "licensor",
  );
  const partnerIsTypeWord =
    !!partnerRaw &&
    /^(?:partnership|collaboration|collaborator|license|licence|licensing|agreement|deal|contract|strategic\s+partnership)$/i.test(
      partnerRaw,
    );
  const partner = partnerIsTypeWord ? null : partnerRaw;
  const nature =
    findLabeled(map, "nature", "scope", "focus", "area") ||
    findLabeled(map, "type", "agreement");
  const asset = findLabeled(map, "product", "asset", "candidate", "indication");

  const natureIsGeneric =
    !nature ||
    /^(?:material agreement|partnership|strategic partnership|collaboration|license|licence|deal|contract)$/i.test(
      nature,
    );

  if (partner && asset && /licen/i.test(groundedCueText(input, map))) {
    return `${company} licenses ${asset} to ${partner}`;
  }
  if (partner && asset && !natureIsGeneric) {
    return `${company} and ${partner} collaborate on ${asset}`;
  }
  if (partner && !natureIsGeneric) {
    return `${company} partners with ${partner} — ${nature}`;
  }
  if (partner) {
    return `${company} announces partnership with ${partner}`;
  }
  if (asset && !natureIsGeneric) {
    return `${company} partnership — ${nature} (${asset})`;
  }
  if (!natureIsGeneric && nature) {
    return `${company} announces ${nature}`;
  }
  return formatPartnershipTitle(company);
}

function dealsTitle(
  input: SubjectTitleInput,
  map: Map<string, string>,
): string {
  const cue = groundedCueText(input, map);
  const company = companyOf(input);
  const value = findLabeled(
    map,
    "deal value",
    "value",
    "consideration",
    "amount",
    "purchase price",
  );
  const target = findLabeled(map, "target", "seller");
  const buyer = findLabeled(map, "buyer", "acquirer");
  const status = findLabeled(map, "status", "close", "stage");

  // Concrete M&A facts beat partnership wording leftover in stored chip titles.
  const hasMaFacts = Boolean(
    target || buyer || (value && isAcquisitionCue(cue)),
  );

  if (!hasMaFacts && isPartnershipCue(cue) && !isAcquisitionCue(cue)) {
    return partnershipTitle(input, map);
  }
  if (
    !hasMaFacts &&
    isPartnershipCue(cue) &&
    findLabeled(map, "partner", "counterparty", "collaborator")
  ) {
    return partnershipTitle(input, map);
  }

  const closed = /\b(?:clos(?:e|ed|ing)|completed?|consummat)/i.test(
    `${status ?? ""} ${cue}`,
  );
  const terminated =
    /\b(?:terminat(?:e|es|ed|ing)?|abandon(?:s|ed|ing)?|withdrawn|broken)\b/i.test(
      `${status ?? ""} ${cue}`,
    );

  if (terminated && target) {
    return `${company} terminates acquisition of ${target}`;
  }
  if (terminated && value) {
    return `${company} terminates ${value} deal`;
  }
  if (terminated) {
    return `${company} terminates announced deal`;
  }
  if (closed && target && value) {
    return `${company} closes ${value} acquisition of ${target}`;
  }
  if (closed && target) {
    return `${company} closes acquisition of ${target}`;
  }
  if (closed && value) {
    return `${company} closes ${value} deal`;
  }
  if (target && value) {
    return `${company} to acquire ${target} for ${value}`;
  }
  if (buyer && value) {
    return `${buyer} to acquire ${company} for ${value}`;
  }
  if (buyer && target) {
    return `${buyer} to acquire ${target}`;
  }
  if (value) {
    return `${company} announces ${value} acquisition`;
  }
  if (target) {
    return `${company} moves to acquire ${target}`;
  }
  if (isAcquisitionCue(cue)) {
    return `${company} - Acquisition Announced (Deal in Play)`;
  }
  return `${company} - Partnership or Major Contract Announced`;
}

function managementTitle(
  input: SubjectTitleInput,
  map: Map<string, string>,
): string {
  const company = companyOf(input);
  const who = findLabeled(map, "officer", "name", "insider");
  const role = findLabeled(map, "role", "position");
  const action = findLabeled(map, "appointment", "departure", "action");

  const act =
    action?.match(/\b(appoint|depart|resign|retire|name)/i)?.[0] ??
    (action && /depart|resign|retire/i.test(action)
      ? "Departure"
      : action && /appoint|name/i.test(action)
        ? "Appointment"
        : null);

  if (who && role && act) {
    const verb = /depart|resign|retire/i.test(act) ? "departs as" : "named";
    return verb === "named"
      ? `${company} names ${who} as ${role}`
      : `${company}: ${who} ${verb} ${role}`;
  }
  if (who && role) {
    return `${company}: ${who} — ${role} change`;
  }
  if (role && act) {
    return `${company} - ${role} Change (${/depart|resign|retire/i.test(act) ? "Departure" : "Appointment"})`;
  }
  return `${company} - Executive Change`;
}

function capitalTitle(
  input: SubjectTitleInput,
  map: Map<string, string>,
): string {
  const company = companyOf(input);
  const amount = findLabeled(map, "amount", "size", "proceeds");
  const shares = findLabeled(map, "shares");
  const coupon = findLabeled(map, "coupon");
  const type = findLabeled(map, "type", "instrument", "facility");
  const form = findLabeled(map, "form");
  const cue = groundedCueText(input, map);
  const atm =
    /atm|at-the-market/i.test(`${type ?? ""} ${cue}`) ||
    Boolean(findFact(map, "atm"));
  const amended = /\bamend/i.test(cue) || /\/A$/i.test(form ?? "");
  const notes = /note|convertible|senior|debenture/i.test(
    `${type ?? ""} ${cue}`,
  );
  const structured = /structured note/i.test(`${type ?? ""} ${cue}`);

  if (structured && coupon) {
    return `${company} prices structured notes · ${coupon}`;
  }
  if (structured) {
    return `${company} files structured note pricing supplement`;
  }
  if (atm && amount) {
    return `${company} sets up ${amount} at-the-market (ATM) program`;
  }
  if (atm) {
    return `${company} sets up at-the-market (ATM) equity program`;
  }
  if (
    (/shelf/i.test(`${type ?? ""} ${cue}`) || /^S-3/i.test(form ?? "")) &&
    amount
  ) {
    return amended
      ? `${company} amends shelf registration to ${amount}`
      : `${company} files ${amount} shelf registration`;
  }
  if (/^S-3/i.test(form ?? "") || /shelf/i.test(`${type ?? ""}`)) {
    return amended
      ? `${company} amends shelf registration (S-3)`
      : formatShelfRegistrationTitle(company);
  }
  if (notes && amount && coupon) {
    return `${company} announces ${amount} notes · ${coupon}`;
  }
  if (notes && amount) {
    return `${company} announces ${amount} note offering`;
  }
  if (amount && shares) {
    return `${company} files ${amount} equity offering (${shares})`;
  }
  if (amount) {
    return `${company} files ${amount} equity offering`;
  }
  if (form && /^424B/i.test(form)) {
    return formatProspectusOfferingTitle(company);
  }
  return formatShelfRegistrationTitle(company);
}

function distressTitle(
  input: SubjectTitleInput,
  map: Map<string, string>,
): string {
  const company = companyOf(input);
  const event = findLabeled(map, "bankruptcy", "delist", "event", "risk");
  const amount = findLabeled(map, "amount", "covenant");
  if (event && /delist/i.test(event)) {
    return `${company} - Delisting Risk (Stock Could Lose Its Listing)`;
  }
  if (event && /bankrupt/i.test(event)) {
    return amount
      ? `${company} bankruptcy filing — ${amount}`
      : `${company} - Bankruptcy Filing (Equity at Risk)`;
  }
  if (amount) return `${company} distress update — ${amount}`;
  return `${company} - Distress disclosure`;
}

function restructuringTitle(
  input: SubjectTitleInput,
  map: Map<string, string>,
): string {
  const company = companyOf(input);
  const charge = findLabeled(map, "charge", "amount", "severance");
  const headcount = findLabeled(map, "headcount", "sites");
  const savings = findLabeled(map, "savings");
  if (charge && headcount) {
    return `${company} restructuring — ${charge}, ${headcount}`;
  }
  if (charge) return `${company} takes restructuring charge of ${charge}`;
  if (headcount) return `${company} restructuring — ${headcount}`;
  if (savings) return `${company} restructuring targeting ${savings}`;
  return `${company} - Restructuring / Exit Costs`;
}

function governanceTitle(
  input: SubjectTitleInput,
  map: Map<string, string>,
): string {
  const company = companyOf(input);
  const event = findLabeled(
    map,
    "auditor",
    "vote",
    "control",
    "board",
    "event",
  );
  if (event && /auditor/i.test(event)) {
    return `${company} - Auditor Change`;
  }
  if (event && /control/i.test(event)) {
    return `${company} - Change of Control`;
  }
  if (event) return `${company} — ${event}`;
  return `${company} - Governance update`;
}

function disclosureTitle(
  input: SubjectTitleInput,
  map: Map<string, string>,
): string {
  const company = companyOf(input);
  const event = findLabeled(map, "event", "item", "fact");
  if (event && event.length >= 8) return `${company} — ${event}`;
  return `${company} - Material disclosure`;
}

function haltTitle(input: SubjectTitleInput, map: Map<string, string>): string {
  const company = companyOf(input);
  const reason =
    input.haltReason ||
    findLabeled(map, "reason", "halt", "status") ||
    "Reason unavailable";
  return formatHaltTitle(company, reason, { reasonIsLabel: true });
}

function insiderTitle(
  input: SubjectTitleInput,
  map: Map<string, string>,
): string {
  const company = companyOf(input);
  const kind: Form4TitleKind = form4TitleKindFromSubcategory(input.subcategory);
  const who = findLabeled(map, "insider", "officer", "name");
  const shares = findLabeled(map, "shares");
  const value = findLabeled(map, "value");
  const direction = findLabeled(map, "direction", "transaction", "buy", "sell");

  const side =
    kind === "buy" || /\bbuy\b/i.test(direction ?? "")
      ? "buy"
      : kind === "sell" || /\bsell|sale\b/i.test(direction ?? "")
        ? "sale"
        : kind === "mixed"
          ? "buy and sell"
          : null;

  const detail = value || shares;
  if (who && side && detail) {
    return `${company} insider ${side}: ${who} · ${detail}`;
  }
  if (who && side) {
    return `${company} insider ${side}: ${who}`;
  }
  if (side && detail) {
    return `${company} insider ${side} · ${detail}`;
  }
  return formatForm4InsiderTitle(kind, company);
}

function regulatoryTitle(
  input: SubjectTitleInput,
  map: Map<string, string>,
): string {
  const company = companyOf(input);
  const product = findLabeled(
    map,
    "product",
    "indication",
    "drug",
    "therapy",
    "device",
  );
  const outcome = findLabeled(
    map,
    "outcome",
    "approval",
    "decision",
    "action",
    "status",
  );
  const agencyRaw = findLabeled(map, "agency", "regulator", "fda");
  const cue = groundedCueText(input, map);
  const agency =
    agencyRaw
      ?.match(/\b(FDA|EMA|MHRA|PMDA|NMPA|SEC|FTC|DOJ)\b/i)?.[1]
      ?.toUpperCase() ??
    (/\bfda\b/i.test(`${agencyRaw ?? ""} ${outcome ?? ""} ${cue}`)
      ? "FDA"
      : agencyRaw && !/^(?:yes|no|true|false)$/i.test(agencyRaw)
        ? agencyRaw
        : null);

  const isApproval = /\bapprov/i.test(`${outcome ?? ""} ${cue}`);
  const isCrl = /\b(?:crl|complete response)\b/i.test(
    `${outcome ?? ""} ${cue}`,
  );
  const isHold = /\b(?:clinical\s+hold|partial\s+hold)\b/i.test(
    `${outcome ?? ""} ${cue}`,
  );
  const isClearance = /\bclear(?:s|ed|ance)\b/i.test(`${outcome ?? ""} ${cue}`);

  const agencyLabel = agency || "FDA";

  if (isCrl && product) {
    return `${company} receives ${agencyLabel} CRL for ${product}`;
  }
  if (isCrl) {
    return `${company} receives ${agencyLabel} Complete Response Letter`;
  }
  if (isHold && product) {
    return `${company} ${product} placed on clinical hold`;
  }
  if (isHold) {
    return `${company} faces clinical hold`;
  }
  if (isApproval && product) {
    return `${company} wins ${agencyLabel} approval for ${product}`;
  }
  if (isClearance && product) {
    return `${agencyLabel} clears ${company}'s ${product}`;
  }
  if (isApproval) {
    return formatFdaApprovalTitle(company);
  }
  if (product && outcome) {
    return `${company}: ${outcome} — ${product}`;
  }
  if (outcome && outcome.length >= 8 && !/^fda$/i.test(outcome)) {
    return `${company}: ${outcome}`;
  }
  // Never invent an approval when facts are thin / non-approval.
  if (
    /fda_approval|approval/i.test(input.subcategory ?? "") ||
    /\bapprov/i.test(cue)
  ) {
    return formatFdaApprovalTitle(company);
  }
  return formatRegulatoryActionTitle(company);
}

function clinicalTitle(
  input: SubjectTitleInput,
  map: Map<string, string>,
): string {
  const company = companyOf(input);
  const phase = findLabeled(map, "phase");
  const status = findLabeled(map, "status", "result", "outcome");
  const condition = findLabeled(
    map,
    "condition",
    "indication",
    "disease",
    "setting",
  );
  const endpoint = findLabeled(map, "endpoint", "primary endpoint");

  const phaseLabel = phase
    ? /phase/i.test(phase)
      ? phase.replace(/\s+/g, " ").trim()
      : `Phase ${phase}`
    : null;

  const statusText = status?.replace(/\s+/g, " ").trim() ?? "";
  const metPrimary =
    /\b(?:met|meets|achieved?)\b.+\bprimary\b/i.test(statusText) ||
    /\bprimary endpoint\b.+\b(?:met|meets)\b/i.test(statusText) ||
    (endpoint && /\b(?:met|meets|achieved?)\b/i.test(statusText));
  const missedPrimary =
    /\b(?:miss(?:ed|es)?|fail(?:ed|s)?|did not meet)\b.+\bprimary\b/i.test(
      statusText,
    );

  if (phaseLabel && metPrimary && condition) {
    return `${company} ${phaseLabel} trial meets primary endpoint in ${condition}`;
  }
  if (phaseLabel && missedPrimary && condition) {
    return `${company} ${phaseLabel} trial misses primary endpoint in ${condition}`;
  }
  if (phaseLabel && metPrimary) {
    return `${company} ${phaseLabel} trial meets primary endpoint`;
  }
  if (phaseLabel && missedPrimary) {
    return `${company} ${phaseLabel} trial misses primary endpoint`;
  }
  if (phaseLabel && endpoint && statusText) {
    return `${company} ${phaseLabel}: ${statusText} (${endpoint})`;
  }
  if (phaseLabel && statusText && condition) {
    return `${company} ${phaseLabel} trial ${statusText} in ${condition}`;
  }
  if (phaseLabel && statusText) {
    return `${company} ${phaseLabel} trial ${statusText}`;
  }
  if (phaseLabel && condition) {
    return `${company} ${phaseLabel} study — ${condition}`;
  }
  if (phaseLabel) {
    return `${company} ${phaseLabel} clinical trial update`;
  }
  if (statusText && condition) {
    return `${company} clinical update — ${condition} (${statusText})`;
  }
  if (endpoint && statusText) {
    return `${company} clinical update — ${statusText} on ${endpoint}`;
  }
  return formatClinicalTrialTitle(company);
}

function macroTitle(
  input: SubjectTitleInput,
  map: Map<string, string>,
): string {
  const print = findLabeled(map, "print", "event");
  const actual = findLabeled(map, "actual");
  const estimate = findLabeled(map, "estimate");
  const period = findLabeled(map, "period", "month");

  const base =
    print ||
    (input.subcategory === "cpi"
      ? "CPI"
      : input.subcategory === "nfp"
        ? "Jobs Report (NFP)"
        : input.subcategory === "fomc"
          ? "FOMC Rate Decision"
          : null);

  if (base && /fomc/i.test(base)) {
    return actual ? `FOMC Rate Decision — ${actual}` : "FOMC Rate Decision";
  }
  if (base && actual && estimate) {
    const month = period ? ` — ${period}` : "";
    return `${base}${month}: ${actual} vs ${estimate} est`;
  }
  if (base && actual) {
    const month = period ? ` — ${period}` : "";
    return `${base}${month}: ${actual}`;
  }
  if (base && period) return `${base} — ${period}`;
  return base || "Macro print";
}

function analystTitle(
  input: SubjectTitleInput,
  map: Map<string, string>,
): string {
  const company = companyOf(input);
  const firm = findLabeled(map, "firm");
  const action = findLabeled(map, "action", "upgrade", "downgrade", "rating");
  const target = findLabeled(map, "target", "pt", "price target");

  if (firm && action && target) {
    return `${company}: ${firm} ${action} · PT ${target}`;
  }
  if (firm && action) {
    return `${company}: ${firm} ${action}`;
  }
  if (action && target) {
    return `${company} ${action} — PT ${target}`;
  }
  if (target) {
    return `${company} price target update — ${target}`;
  }
  if (action && /upgrade|downgrade|rating/i.test(action)) {
    return formatAnalystRatingTitle(company);
  }
  return formatPriceTargetTitle(company);
}

function cyberTitle(
  input: SubjectTitleInput,
  map: Map<string, string>,
): string {
  const company = companyOf(input);
  const incident = findLabeled(map, "incident", "event", "type");
  const impact = findLabeled(map, "impact", "system", "data");
  if (incident && impact) {
    return `${company} cybersecurity incident — ${impact}`;
  }
  if (incident) return `${company} discloses ${incident}`;
  return `${company} - Material Cybersecurity Incident`;
}

function newsTitle(input: SubjectTitleInput, map: Map<string, string>): string {
  const company = companyOf(input);
  const stored =
    normalizeWs(input.title ?? "") || normalizeWs(input.headline ?? "");
  if (stored && looksFactEnrichedTitle(stored)) return stored;
  if (
    stored &&
    stored.length >= 16 &&
    !/^(?:news|press release)$/i.test(stored)
  ) {
    return stored;
  }
  const event = findLabeled(map, "event", "headline", "detail");
  if (event) return `${company} — ${event}`;
  return stored || `${company} — Company news`;
}

function otherTitle(
  input: SubjectTitleInput,
  map: Map<string, string>,
): string | null {
  const company = companyOf(input);
  const event = findLabeled(map, "event", "fact", "detail");
  if (event && event.length >= 8 && !/8-?k filing/i.test(event)) {
    return `${company} — ${event}`;
  }
  const stored =
    normalizeWs(input.title ?? "") || normalizeWs(input.headline ?? "");
  if (
    !stored ||
    looksTaxonomyChipTitle(stored) ||
    looksLegacyStiffTitle(stored) ||
    /8-?k filing/i.test(stored)
  ) {
    return null;
  }
  return stored;
}

function ownershipTitle(
  input: SubjectTitleInput,
  map: Map<string, string>,
): string | null {
  const company = companyOf(input);
  const ticker = input.symbol?.trim().toUpperCase() || company;
  const pct = findLabeled(map, "ownership", "stake", "%");
  const type = findLabeled(map, "type", "form");
  const form = findLabeled(map, "form") || "";
  const is13d =
    input.subcategory === "13d" ||
    /13d/i.test(form) ||
    /13d|active ownership/i.test(type ?? "");
  const is13g =
    input.subcategory === "13g" ||
    /13g/i.test(form) ||
    /13g|passive ownership/i.test(type ?? "");

  if (is13d) {
    return pct
      ? `${ticker} — 13D stake ~${pct}`
      : formatSchedule13DTitle(company);
  }
  if (is13g) {
    return pct
      ? `${ticker} — 13G stake ~${pct}`
      : formatSchedule13GTitle(company);
  }
  return null;
}

/**
 * Build a subject-distinct professional title from extracted facts.
 * Seeds from fetch type/items/summary cues when keyFacts are thin so existing
 * rows still get subject-aware titles — never invents numbers.
 */
export function buildSubjectTitle(input: SubjectTitleInput): string | null {
  const rawFacts = (input.keyFacts ?? [])
    .map((f) => ({
      label: normalizeWs(f.label ?? ""),
      value: normalizeWs(f.value ?? ""),
    }))
    .filter((f) => f.label && f.value);

  const facts = mergeFacts(rawFacts, seedFactsFromFetch(input));
  const map = factMap(facts);
  const category = categoryOf(input.eventCategory);
  const hasUsefulFacts = facts.length > 0;
  const cue = groundedCueText(input, map);
  const stored = normalizeWs(input.title ?? "");

  // 13D/G often classified under deals — try ownership first when form says so.
  const ownership = ownershipTitle(input, map);
  if (
    ownership &&
    (input.subcategory === "13d" ||
      input.subcategory === "13g" ||
      /13[DG]/i.test(findLabeled(map, "form") ?? "") ||
      /13[DG]/i.test(input.type ?? ""))
  ) {
    return ownership;
  }

  // Subject-case engine for the five subjects so *existing* rows upgrade on read.
  // Structured notes keep the legacy capital voice (coupon / pricing supplement).
  // Keep specific study/wire headlines that are already richer than the case template.
  if (
    categoryEligibleForCaseEngine(input.eventCategory) &&
    !/\bstructured note\b/i.test(cue)
  ) {
    const engineered = buildCaseEngineTitle(input, facts);
    if (engineered) {
      if (shouldUpgradeStoredToCaseTitle(stored, engineered)) {
        return engineered;
      }
      if (stored) return stored;
      return engineered;
    }
  }

  // Prefer keeping an already fact-rich stored title for other subjects /
  // when the case engine does not apply.
  if (looksFactEnrichedTitle(stored)) {
    if (
      (category === "capital" || category === "deals") &&
      hasUsefulFacts &&
      findLabeled(map, "amount", "coupon", "ownership")
    ) {
      // fall through to builders
    } else {
      return stored;
    }
  }

  if (!hasUsefulFacts) {
    // Truly empty payload — only high-signal categories with formatters.
    switch (category) {
      case "trading_halt":
        return haltTitle(input, map);
      case "earnings":
        return formatEarningsReportTitle(
          earningsQuarterLabel(input.quarter, input.dateYmd),
          companyOf(input),
        );
      case "insider":
        return formatForm4InsiderTitle(
          form4TitleKindFromSubcategory(input.subcategory),
          companyOf(input),
        );
      case "regulatory":
        return regulatoryTitle(input, map);
      case "clinical":
        return clinicalTitle(input, map);
      case "capital":
        return capitalTitle(input, map);
      case "deals":
        return dealsTitle(input, map);
      default:
        return null;
    }
  }

  // Fetch-seeded facts (form/items/summary $) are enough to voice capital/deals
  // even when enrich keyFacts were empty on older rows.
  if (
    category === "other" &&
    (/^S-3|^424B|^425|13[DG]/i.test(input.type ?? "") ||
      isPartnershipCue(cue) ||
      isAcquisitionCue(cue))
  ) {
    if (
      /^S-3|^424B/i.test(input.type ?? "") ||
      /\bshelf\b|\bATM\b/i.test(cue)
    ) {
      return capitalTitle(input, map);
    }
    return ownership ?? dealsTitle(input, map);
  }

  switch (category) {
    case "earnings":
      return earningsTitle(input, map);
    case "deals":
      return ownership ?? dealsTitle(input, map);
    case "management":
      return managementTitle(input, map);
    case "capital":
      return capitalTitle(input, map);
    case "distress":
      return distressTitle(input, map);
    case "restructuring":
      return restructuringTitle(input, map);
    case "governance":
      return governanceTitle(input, map);
    case "disclosure":
      return disclosureTitle(input, map);
    case "trading_halt":
      return haltTitle(input, map);
    case "insider":
      return insiderTitle(input, map);
    case "regulatory":
      return regulatoryTitle(input, map);
    case "clinical":
      return clinicalTitle(input, map);
    case "macro":
      return macroTitle(input, map);
    case "analyst":
      return analystTitle(input, map);
    case "cyber":
      return cyberTitle(input, map);
    case "news":
      return newsTitle(input, map);
    case "other":
    default:
      return otherTitle(input, map);
  }
}

/**
 * Display-path helper: prefer subject title when it adds concrete facts
 * or a professional thin voice over taxonomy / legacy stiff chips.
 * Never overwrite a specific study/wire headline with a thin chip.
 */
export function preferSubjectTitle(
  input: SubjectTitleInput,
  fallback: string,
): string {
  const built = buildSubjectTitle(input);
  if (!built) return fallback;
  const fb = normalizeWs(fallback);
  if (!fb) return built;

  const builtRich = looksFactEnrichedTitle(built);
  const fbRich = looksFactEnrichedTitle(fb);
  const builtThin = looksProfessionalThinTitle(built);
  const fbStiff = looksLegacyStiffTitle(fb) || looksTaxonomyChipTitle(fb);

  // Fact-rich always beats chips / stiff / thin.
  if (builtRich && !fbRich) return built;
  if (builtRich && fbRich) {
    if (built.length > fb.length + 8 && hasUsefulDetail(built, fb)) {
      return built;
    }
    return built;
  }

  // Professional thin upgrades chips / legacy stiff only — keep specific headlines.
  if (builtThin && fbStiff && !fbRich) return built;

  if (built.length > fb.length + 8 && hasUsefulDetail(built, fb) && !fbRich) {
    return built;
  }

  return fbRich || (!fbStiff && !builtRich) ? fallback : built;
}

function hasUsefulDetail(candidate: string, fallback: string): boolean {
  const c = candidate.toLowerCase();
  const f = fallback.toLowerCase();
  if (c === f) return false;
  return (
    /\$|\d+%|shares|stake|eps|phase|coupon|offering|shelf|insider|acquire|partner|crl|endpoint|atm/i.test(
      candidate,
    ) && !/unknown company/i.test(candidate)
  );
}

/**
 * Upgrade legacy/chip/old fact sentences to case-engine templates on read,
 * but keep specific study/wire headlines that already name the study/drug detail.
 *
 * Root cause of stuck rows: looksFactEnrichedTitle treated many pre-case builder
 * voices (licenses, credit facility, phase trials, CRL, partners with, …) as
 * “already rich” and the old final gate refused to upgrade them. Default is now
 * upgrade whenever the case engine produced a title; only denser specific
 * headlines and already-canonical case shapes (with no new facts) are kept.
 */
function shouldUpgradeStoredToCaseTitle(
  stored: string,
  engineered: string,
): boolean {
  const s = normalizeWs(stored);
  const eng = normalizeWs(engineered);
  if (!s) return true;
  // Identical → keep; case-only drift → canonicalize to engineered template.
  if (s === eng) return false;
  if (s.toLowerCase() === eng.toLowerCase()) return true;

  if (
    looksLegacyStiffTitle(s) ||
    looksTaxonomyChipTitle(s) ||
    looksProfessionalThinTitle(s)
  ) {
    return true;
  }

  // Never replace a denser study/wire headline with a thinner template.
  if (isDenserSpecificHeadline(s, eng)) {
    return false;
  }

  // Never replace a fact-rich legacy M&A sentence with a thin chip.
  if (looksProfessionalThinTitle(eng) && looksFactEnrichedTitle(s)) {
    return false;
  }

  // Already on a case-engine template: only swap when engineered adds facts
  // ($ / close verb / definitive phrasing / fuller party name) the stored line lacks.
  if (looksCaseShapedEngineTitle(s)) {
    if (/\$/.test(eng) && !/\$/.test(s)) return true;
    if (
      /\bCompletes Acquisition\b/i.test(eng) &&
      !/\bCompletes Acquisition\b/i.test(s)
    ) {
      return true;
    }
    if (
      /\bAnnounces Acquisition of\b/i.test(s) &&
      /\bAgrees to Acquire\b/i.test(eng) &&
      /\$/.test(eng)
    ) {
      return true;
    }
    if (
      /\bdefinitive agreement\b/i.test(s) &&
      /\bEnters Definitive Agreement to Acquire\b/i.test(eng) &&
      !/\bEnters Definitive Agreement to Acquire\b/i.test(s)
    ) {
      return true;
    }
    if (
      /\bATM\b|at-the-market/i.test(eng) &&
      !/\bATM\b|at-the-market/i.test(s)
    ) {
      return true;
    }
    // Engineered adds a fuller party/asset name (Rival → Rival Inc) or tokens.
    if (eng.length > s.length && hasUsefulDetail(eng, s)) {
      return true;
    }
    // Same template family, no new material slots — keep stored casing/voice.
    return false;
  }

  // Pre-case builder / legacy fact voices across all five subjects → upgrade.
  if (
    looksLegacyFinancingFactTitle(s) ||
    looksLegacyPartnershipFactTitle(s) ||
    looksLegacyRegulatoryFactTitle(s) ||
    looksLegacyClinicalFactTitle(s) ||
    looksLegacyMaFactTitle(s)
  ) {
    return true;
  }

  // Default: apply case-engine guidelines on read (chips already handled above).
  return true;
}
