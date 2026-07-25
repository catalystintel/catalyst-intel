/**
 * Parse 8-K Item 5.02 (and related) text for C-suite role + appointment/departure.
 * Used to build tape titles: `{Company} - {Position} Change - {Appointment|Departure}`.
 */

export type OfficerChangeAction = "Appointment" | "Departure";

export type ParsedOfficerDirectorChange = {
  /** Short role label (CEO, CFO, …), or null when unknown. */
  position: string | null;
  action: OfficerChangeAction | null;
};

/** Lower rank = higher market impact (prefer when multiple officers appear). */
const ROLE_PATTERNS: ReadonlyArray<{
  position: string;
  rank: number;
  pattern: RegExp;
}> = [
  {
    position: "CEO",
    rank: 1,
    pattern: /\b(?:chief\s+executive\s+officer|ceo)\b/i,
  },
  {
    position: "CFO",
    rank: 2,
    pattern: /\b(?:chief\s+financial\s+officer|cfo)\b/i,
  },
  {
    position: "COO",
    rank: 3,
    pattern: /\b(?:chief\s+operating\s+officer|coo)\b/i,
  },
  {
    position: "CTO",
    rank: 4,
    pattern: /\b(?:chief\s+technology\s+officer|cto)\b/i,
  },
  {
    position: "CMO",
    rank: 5,
    pattern: /\b(?:chief\s+marketing\s+officer|cmo)\b/i,
  },
  {
    position: "CRO",
    rank: 6,
    pattern: /\b(?:chief\s+revenue\s+officer|cro)\b/i,
  },
  {
    position: "CISO",
    rank: 7,
    pattern: /\b(?:chief\s+information\s+security\s+officer|ciso)\b/i,
  },
  {
    position: "CHRO",
    rank: 8,
    pattern: /\b(?:chief\s+human\s+resources\s+officer|chro)\b/i,
  },
  {
    position: "CIO",
    rank: 9,
    pattern: /\b(?:chief\s+information\s+officer|cio)\b/i,
  },
  {
    position: "CPO",
    rank: 10,
    pattern: /\b(?:chief\s+product\s+officer|cpo)\b/i,
  },
  {
    position: "CLO",
    rank: 11,
    pattern: /\b(?:chief\s+legal\s+officer|clo)\b/i,
  },
  {
    position: "CCO",
    rank: 12,
    pattern:
      /\b(?:chief\s+compliance\s+officer|chief\s+commercial\s+officer|cco)\b/i,
  },
  {
    position: "President",
    rank: 13,
    // Avoid matching the "President" inside "Vice President".
    pattern: /\b(?<!vice\s)president\b/i,
  },
];

const APPOINTMENT_RE =
  /\b(?:appoint(?:ed|s|ment)?|elect(?:ed|s|ion)?|nam(?:ed|es|ing)|hir(?:ed|es|ing)|succeed(?:ed|s|ing)|join(?:ed|s|ing)|promot(?:ed|es|ion)|designat(?:ed|es|ion))\b/i;

const DEPARTURE_RE =
  /\b(?:resign(?:ed|s|ation)?|depart(?:ed|s|ure)?|terminat(?:ed|es|ion)|retir(?:ed|es|ement)|step(?:s|ped)?\s+down|left\b|leaving|dismiss(?:ed|al)|remov(?:ed|al)|separat(?:ed|ion))\b/i;

/** Standard Item 5.02 catalog phrasing — not a concrete person/event signal. */
const ITEM_502_BOILERPLATE: RegExp[] = [
  /Departure of Directors or Certain Officers/gi,
  /Election of Directors/gi,
  /Appointment of Certain Officers/gi,
  /Compensatory Arrangements of Certain Officers/gi,
  /CEO\/CFO Departure or Appointment/gi,
  /Officer\s*\/\s*Director Change/gi,
];

const CONTEXT_RADIUS = 120;

function stripBoilerplate(text: string): string {
  let out = text;
  for (const re of ITEM_502_BOILERPLATE) {
    out = out.replace(re, " ");
  }
  return out.replace(/\s+/g, " ").trim();
}

function firstMatchIndex(text: string, re: RegExp): number {
  const match = re.exec(text);
  return match ? match.index : -1;
}

/** Prefer the action verb closest to `anchorIndex` when both appear. */
function detectActionNear(
  text: string,
  anchorIndex = 0,
): OfficerChangeAction | null {
  if (!text) return null;
  const aIdx = firstMatchIndex(text, new RegExp(APPOINTMENT_RE.source, "i"));
  const dIdx = firstMatchIndex(text, new RegExp(DEPARTURE_RE.source, "i"));
  const hasA = aIdx >= 0;
  const hasD = dIdx >= 0;
  if (hasA && !hasD) return "Appointment";
  if (hasD && !hasA) return "Departure";
  if (hasA && hasD) {
    const aDist = Math.abs(aIdx - anchorIndex);
    const dDist = Math.abs(dIdx - anchorIndex);
    if (aDist !== dDist) return aDist < dDist ? "Appointment" : "Departure";
    return aIdx <= dIdx ? "Appointment" : "Departure";
  }
  return null;
}

function detectAction(text: string): OfficerChangeAction | null {
  return detectActionNear(text, 0);
}

/**
 * Infer C-suite position + Appointment/Departure from Item 5.02 summary /
 * raw filing text. Prefers highest-impact role when several are mentioned.
 */
export function parseOfficerDirectorChange(
  ...texts: Array<string | null | undefined>
): ParsedOfficerDirectorChange {
  const joined = texts
    .map((t) => t?.replace(/\s+/g, " ").trim())
    .filter((t): t is string => Boolean(t && t.length > 0))
    .join(" ");
  if (!joined) return { position: null, action: null };

  const cleaned = stripBoilerplate(joined);
  if (!cleaned) return { position: null, action: null };

  type Hit = {
    position: string;
    rank: number;
    index: number;
    action: OfficerChangeAction | null;
  };
  const hits: Hit[] = [];

  for (const role of ROLE_PATTERNS) {
    const re = new RegExp(role.pattern.source, "gi");
    let match: RegExpExecArray | null;
    while ((match = re.exec(cleaned)) !== null) {
      const start = Math.max(0, match.index - CONTEXT_RADIUS);
      const end = Math.min(
        cleaned.length,
        match.index + match[0].length + CONTEXT_RADIUS,
      );
      const window = cleaned.slice(start, end);
      const anchorInWindow = match.index - start;
      hits.push({
        position: role.position,
        rank: role.rank,
        index: match.index,
        action: detectActionNear(window, anchorInWindow),
      });
    }
  }

  hits.sort((a, b) => a.rank - b.rank || a.index - b.index);

  const withAction = hits.find((h) => h.action);
  if (withAction) {
    return { position: withAction.position, action: withAction.action };
  }

  const globalAction = detectAction(cleaned);
  if (hits[0]) {
    return { position: hits[0].position, action: globalAction };
  }

  return { position: null, action: globalAction };
}
